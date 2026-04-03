package com.shieldsecurity.mobile.scan

import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import androidx.documentfile.provider.DocumentFile
import com.shieldsecurity.mobile.ScanMode
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileInputStream
import java.io.InputStream
import java.io.ByteArrayOutputStream
import java.security.MessageDigest
import java.util.ArrayDeque
import java.util.Locale
import java.util.zip.ZipException
import java.util.zip.ZipFile
import kotlin.coroutines.coroutineContext

enum class ThreatSeverity {
    Low,
    Medium,
    High,
}

data class ThreatFinding(
    val displayName: String,
    val location: String,
    val reason: String,
    val severity: ThreatSeverity,
    val score: Int,
    val sha256: String? = null,
)

data class ScanProgressEvent(
    val scannedItems: Int,
    val totalEstimate: Int,
    val stage: String,
    val currentTarget: String,
)

data class ThreatScanReport(
    val mode: ScanMode,
    val sourceLabel: String,
    val scannedItems: Int,
    val findings: List<ThreatFinding>,
    val elapsedMs: Long,
    val limitReached: Boolean,
)

private data class ArchiveInspectionResult(
    val score: Int,
    val reasons: List<String>,
)

private data class RiskToken(
    val needle: String,
    val score: Int,
    val reason: String,
)

private const val QuickScanLimit = 1800
private const val DeepScanLimit = 9000
private const val CustomScanLimit = 4000
private const val MaxSampleBytes = 768 * 1024
private const val MaxArchiveBytes = 96L * 1024L * 1024L
private const val MinFindingScore = 25

class LocalThreatScanner(
    private val context: Context,
) {

    suspend fun scanQuick(
        onProgress: suspend (ScanProgressEvent) -> Unit,
    ): ThreatScanReport {
        val roots = buildQuickScanRoots().filter { it.exists() }
        return scanFileRoots(
            mode = ScanMode.Quick,
            sourceLabel = "Быстрая проверка устройства",
            roots = roots,
            fileLimit = QuickScanLimit,
            stageLabel = "Проверяем загрузки, APK и опасные зоны",
            onProgress = onProgress,
        )
    }

    suspend fun scanDeep(
        onProgress: suspend (ScanProgressEvent) -> Unit,
    ): ThreatScanReport {
        val roots = listOf(Environment.getExternalStorageDirectory()).filter { it.exists() }
        return scanFileRoots(
            mode = ScanMode.Deep,
            sourceLabel = "Глубокая проверка всего хранилища",
            roots = roots,
            fileLimit = DeepScanLimit,
            stageLabel = "Рекурсивно анализируем файлы и архивы",
            onProgress = onProgress,
        )
    }

    suspend fun scanTree(
        treeUri: Uri,
        sourceLabel: String,
        onProgress: suspend (ScanProgressEvent) -> Unit,
    ): ThreatScanReport = withContext(Dispatchers.IO) {
        val root = DocumentFile.fromTreeUri(context, treeUri)
            ?: error("Не удалось открыть выбранную папку.")
        val startedAt = System.currentTimeMillis()
        val findings = mutableListOf<ThreatFinding>()
        val stack = ArrayDeque<Pair<DocumentFile, String>>()
        val rootLabel = root.name ?: sourceLabel
        stack.add(root to rootLabel)
        var scannedItems = 0
        var limitReached = false

        while (stack.isNotEmpty()) {
            coroutineContext.ensureActive()
            val (entry, label) = stack.removeLast()

            if (entry.isDirectory) {
                entry.listFiles()
                    .sortedByDescending { child -> child.name?.lowercase(Locale.ROOT).orEmpty() }
                    .forEach { child ->
                        if (!shouldSkipDocument(child)) {
                            val childLabel = if (label.isBlank()) {
                                child.name.orEmpty()
                            } else {
                                "$label/${child.name.orEmpty()}"
                            }
                            stack.add(child to childLabel)
                        }
                    }
                continue
            }

            if (!entry.isFile) {
                continue
            }

            scannedItems += 1
            if (scannedItems == 1 || scannedItems % 4 == 0) {
                onProgress(
                    ScanProgressEvent(
                        scannedItems = scannedItems,
                        totalEstimate = CustomScanLimit,
                        stage = "Проверяем выбранную папку",
                        currentTarget = label,
                    ),
                )
            }

            inspectContentUri(
                uri = entry.uri,
                name = entry.name ?: "unknown",
                pathLabel = label,
                sizeBytes = entry.length(),
            )?.let(findings::add)

            if (scannedItems >= CustomScanLimit) {
                limitReached = true
                break
            }
        }

        ThreatScanReport(
            mode = ScanMode.Custom,
            sourceLabel = sourceLabel,
            scannedItems = scannedItems,
            findings = findings.sortedByDescending { it.score },
            elapsedMs = System.currentTimeMillis() - startedAt,
            limitReached = limitReached,
        )
    }

    suspend fun scanApk(
        apkUri: Uri,
        fileName: String,
        onProgress: suspend (ScanProgressEvent) -> Unit,
    ): ThreatScanReport = withContext(Dispatchers.IO) {
        val startedAt = System.currentTimeMillis()
        onProgress(
            ScanProgressEvent(
                scannedItems = 0,
                totalEstimate = 1,
                stage = "Анализируем APK",
                currentTarget = fileName,
            ),
        )

        val finding = inspectContentUri(
            uri = apkUri,
            name = fileName,
            pathLabel = fileName,
            sizeBytes = resolveUriSize(apkUri),
        )

        onProgress(
            ScanProgressEvent(
                scannedItems = 1,
                totalEstimate = 1,
                stage = "Собираем отчёт",
                currentTarget = fileName,
            ),
        )

        ThreatScanReport(
            mode = ScanMode.Custom,
            sourceLabel = "APK: $fileName",
            scannedItems = 1,
            findings = listOfNotNull(finding),
            elapsedMs = System.currentTimeMillis() - startedAt,
            limitReached = false,
        )
    }

    private suspend fun scanFileRoots(
        mode: ScanMode,
        sourceLabel: String,
        roots: List<File>,
        fileLimit: Int,
        stageLabel: String,
        onProgress: suspend (ScanProgressEvent) -> Unit,
    ): ThreatScanReport = withContext(Dispatchers.IO) {
        val startedAt = System.currentTimeMillis()
        val findings = mutableListOf<ThreatFinding>()
        val stack = ArrayDeque<File>()
        roots.sortedByDescending { it.absolutePath.lowercase(Locale.ROOT) }.forEach(stack::add)
        var scannedItems = 0
        var limitReached = false

        while (stack.isNotEmpty()) {
            coroutineContext.ensureActive()
            val file = stack.removeLast()

            if (file.isDirectory) {
                if (shouldSkipDirectory(file)) {
                    continue
                }

                file.listFiles()
                    ?.sortedByDescending { child -> child.name.lowercase(Locale.ROOT) }
                    ?.forEach(stack::add)
                continue
            }

            if (!file.isFile) {
                continue
            }

            scannedItems += 1
            if (scannedItems == 1 || scannedItems % 4 == 0) {
                onProgress(
                    ScanProgressEvent(
                        scannedItems = scannedItems,
                        totalEstimate = fileLimit,
                        stage = stageLabel,
                        currentTarget = file.absolutePath,
                    ),
                )
            }

            inspectFile(file)?.let(findings::add)

            if (scannedItems >= fileLimit) {
                limitReached = true
                break
            }
        }

        ThreatScanReport(
            mode = mode,
            sourceLabel = sourceLabel,
            scannedItems = scannedItems,
            findings = findings.sortedByDescending { it.score },
            elapsedMs = System.currentTimeMillis() - startedAt,
            limitReached = limitReached,
        )
    }

    private fun inspectFile(file: File): ThreatFinding? {
        return inspectCandidate(
            name = file.name,
            pathLabel = file.absolutePath,
            sizeBytes = file.length(),
            openSampleStream = {
                runCatching { FileInputStream(file) }.getOrNull()
            },
            openFullStream = {
                runCatching { FileInputStream(file) }.getOrNull()
            },
            materializeArchive = if (isArchiveName(file.name)) {
                { file }
            } else {
                null
            },
        )
    }

    private fun inspectContentUri(
        uri: Uri,
        name: String,
        pathLabel: String,
        sizeBytes: Long,
    ): ThreatFinding? {
        return inspectCandidate(
            name = name,
            pathLabel = pathLabel,
            sizeBytes = sizeBytes,
            openSampleStream = {
                runCatching { context.contentResolver.openInputStream(uri) }.getOrNull()
            },
            openFullStream = {
                runCatching { context.contentResolver.openInputStream(uri) }.getOrNull()
            },
            materializeArchive = if (isArchiveName(name) && sizeBytes in 1..MaxArchiveBytes) {
                {
                    copyUriToCache(uri, name)
                }
            } else {
                null
            },
        )
    }

    private fun inspectCandidate(
        name: String,
        pathLabel: String,
        sizeBytes: Long,
        openSampleStream: () -> InputStream?,
        openFullStream: () -> InputStream?,
        materializeArchive: (() -> File?)? = null,
    ): ThreatFinding? {
        val lowerName = name.lowercase(Locale.ROOT)
        val extension = lowerName.substringAfterLast('.', "")
        val reasons = linkedSetOf<String>()
        var score = 0

        if (extension in SuspiciousExtensions) {
            score += 16
            reasons += "Подозрительный тип файла .$extension"
        }

        if (SuspiciousNameRegex.containsMatchIn(lowerName)) {
            score += 28
            reasons += "Имя файла похоже на dropper, loader или крак"
        }

        if (lowerName.startsWith(".") && extension in SuspiciousExtensions) {
            score += 10
            reasons += "Скрытый исполняемый или скриптовый файл"
        }

        if (shouldInspectContent(extension, lowerName, sizeBytes)) {
            val sampleBytes = openSampleStream()?.use { input ->
                input.readLimited(MaxSampleBytes)
            } ?: ByteArray(0)

            if (sampleBytes.isNotEmpty()) {
                if (containsEicar(sampleBytes)) {
                    score = 100
                    reasons += "Обнаружена тестовая сигнатура EICAR"
                }

                val textSample = sampleBytes.toString(Charsets.ISO_8859_1).lowercase(Locale.ROOT)
                RiskTokens.forEach { token ->
                    if (textSample.contains(token.needle)) {
                        score += token.score
                        reasons += token.reason
                    }
                }
            }
        }

        if (materializeArchive != null && extension in ArchiveExtensions && sizeBytes in 1..MaxArchiveBytes) {
            val tempFile = materializeArchive()
            if (tempFile != null && tempFile.exists()) {
                try {
                    val archive = inspectArchive(tempFile, extension)
                    score += archive.score
                    reasons += archive.reasons
                } finally {
                    if (!tempFile.isSamePath(pathLabel)) {
                        tempFile.delete()
                    }
                }
            }
        }

        if (score < MinFindingScore || reasons.isEmpty()) {
            return null
        }

        val finalScore = score.coerceAtMost(100)
        return ThreatFinding(
            displayName = name,
            location = pathLabel,
            reason = reasons.joinToString(separator = "; "),
            severity = severityForScore(finalScore),
            score = finalScore,
            sha256 = openFullStream()?.use(::sha256Hex),
        )
    }

    private fun inspectArchive(file: File, extension: String): ArchiveInspectionResult {
        val reasons = linkedSetOf<String>()
        var score = 0

        try {
            ZipFile(file).use { zip ->
                var dexCount = 0
                var nestedPackageCount = 0
                var suspiciousEntries = 0

                zip.entries().asSequence().take(400).forEach { entry ->
                    val entryName = entry.name.lowercase(Locale.ROOT)
                    if (entryName.contains("../") || entryName.startsWith("/")) {
                        score += 35
                        reasons += "Архив содержит traversal-пути"
                    }

                    if (entryName.endsWith(".dex")) {
                        dexCount += 1
                    }

                    if (entryName.endsWith(".apk") || entryName.endsWith(".jar") || entryName.endsWith(".xapk")) {
                        nestedPackageCount += 1
                    }

                    if (SuspiciousNameRegex.containsMatchIn(entryName)) {
                        suspiciousEntries += 1
                    }

                    if (!entry.isDirectory && shouldInspectArchiveEntry(entryName, entry.size)) {
                        val sample = zip.getInputStream(entry).use { input ->
                            input.readLimited(64 * 1024)
                        }
                        val textSample = sample.toString(Charsets.ISO_8859_1).lowercase(Locale.ROOT)
                        RiskTokens.forEach { token ->
                            if (textSample.contains(token.needle)) {
                                score += token.score / 2
                                reasons += "Архив содержит ${token.reason.lowercase(Locale.ROOT)}"
                            }
                        }
                    }
                }

                if (dexCount >= 4) {
                    score += 18
                    reasons += "Слишком много DEX-модулей внутри пакета"
                }

                if (nestedPackageCount > 0) {
                    score += 14
                    reasons += "Внутри APK/архива есть вложенные пакеты"
                }

                if (suspiciousEntries > 0) {
                    score += (10 + suspiciousEntries * 4).coerceAtMost(24)
                    reasons += "В архиве найдены подозрительные названия файлов"
                }
            }
        } catch (_: ZipException) {
            score += 22
            reasons += "Файл маскируется под архив, но повреждён или обфусцирован"
        } catch (_: Exception) {
            // Ignore unreadable archives to keep scans stable.
        }

        if (extension == "apk") {
            val permissionSignals = inspectApkPermissions(file)
            score += permissionSignals.score
            reasons += permissionSignals.reasons
        }

        return ArchiveInspectionResult(
            score = score,
            reasons = reasons.toList(),
        )
    }

    private fun inspectApkPermissions(file: File): ArchiveInspectionResult {
        val reasons = linkedSetOf<String>()
        var score = 0
        val permissions = readRequestedPermissions(file)

        if (permissions.isEmpty()) {
            return ArchiveInspectionResult(0, emptyList())
        }

        permissions.forEach { permission ->
            score += RiskyPermissions[permission] ?: 0
        }

        if (permissions.contains("android.permission.BIND_ACCESSIBILITY_SERVICE")) {
            reasons += "APK запрашивает доступ к AccessibilityService"
        }
        if (permissions.contains("android.permission.REQUEST_INSTALL_PACKAGES")) {
            reasons += "APK может инициировать установку других пакетов"
        }
        if (permissions.contains("android.permission.SYSTEM_ALERT_WINDOW")) {
            reasons += "APK может рисовать поверх других окон"
        }
        if (permissions.contains("android.permission.RECEIVE_BOOT_COMPLETED")) {
            reasons += "APK автозапускается после перезагрузки"
        }
        if (permissions.contains("android.permission.SEND_SMS") || permissions.contains("android.permission.RECEIVE_SMS")) {
            reasons += "APK работает с SMS-разрешениями"
        }

        if (
            permissions.contains("android.permission.BIND_ACCESSIBILITY_SERVICE") &&
            permissions.contains("android.permission.SYSTEM_ALERT_WINDOW")
        ) {
            score += 24
            reasons += "Опасная комбинация overlay + accessibility"
        }

        if (
            permissions.contains("android.permission.REQUEST_INSTALL_PACKAGES") &&
            permissions.contains("android.permission.RECEIVE_BOOT_COMPLETED")
        ) {
            score += 18
            reasons += "Опасная комбинация автозапуска и установки пакетов"
        }

        return ArchiveInspectionResult(
            score = score,
            reasons = reasons.toList(),
        )
    }

    private fun readRequestedPermissions(file: File): List<String> {
        val packageManager = context.packageManager
        val packageInfo = try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                packageManager.getPackageArchiveInfo(
                    file.absolutePath,
                    PackageManager.PackageInfoFlags.of(PackageManager.GET_PERMISSIONS.toLong()),
                )
            } else {
                @Suppress("DEPRECATION")
                packageManager.getPackageArchiveInfo(
                    file.absolutePath,
                    PackageManager.GET_PERMISSIONS,
                )
            }
        } catch (_: Exception) {
            null
        }

        return packageInfo?.requestedPermissions?.toList().orEmpty()
    }

    private fun copyUriToCache(uri: Uri, name: String): File? {
        val suffix = if (name.contains('.')) {
            ".${name.substringAfterLast('.')}"
        } else {
            ".bin"
        }

        return try {
            val tempFile = File.createTempFile("shieldsecurity-scan-", suffix, context.cacheDir)
            val inputStream = context.contentResolver.openInputStream(uri) ?: return null
            inputStream.use { input ->
                tempFile.outputStream().use(input::copyTo)
            }
            tempFile
        } catch (_: Exception) {
            null
        }
    }

    @Suppress("DEPRECATION")
    private fun buildQuickScanRoots(): List<File> {
        val root = Environment.getExternalStorageDirectory()
        return listOf(
            File(root, "Download"),
            File(root, "Documents"),
            File(root, "Telegram"),
            File(root, "WhatsApp"),
            File(root, "DCIM"),
            File(root, "Bluetooth"),
            File(root, "Movies"),
            File(root, "Music"),
        ).distinctBy { it.absolutePath }
    }

    private fun resolveUriSize(uri: Uri): Long {
        val descriptor = runCatching {
            context.contentResolver.openAssetFileDescriptor(uri, "r")
        }.getOrNull()
        return descriptor?.use { it.length } ?: -1L
    }

    private fun shouldSkipDirectory(file: File): Boolean {
        val name = file.name.lowercase(Locale.ROOT)
        return name in SkipDirectoryNames ||
            file.absolutePath.contains("/android/obb", ignoreCase = true)
    }

    private fun shouldSkipDocument(document: DocumentFile): Boolean {
        val name = document.name?.lowercase(Locale.ROOT).orEmpty()
        return name in SkipDirectoryNames
    }

    private fun shouldInspectContent(
        extension: String,
        lowerName: String,
        sizeBytes: Long,
    ): Boolean {
        if (extension in TextLikeExtensions || extension in SuspiciousExtensions || extension in ArchiveExtensions) {
            return true
        }
        if (SuspiciousNameRegex.containsMatchIn(lowerName)) {
            return true
        }
        if (extension in SafeMediaExtensions && sizeBytes > 256 * 1024) {
            return false
        }
        return sizeBytes in 1..(512 * 1024)
    }

    private fun shouldInspectArchiveEntry(
        entryName: String,
        entrySize: Long,
    ): Boolean {
        if (entrySize <= 0 || entrySize > 256 * 1024) {
            return false
        }
        val ext = entryName.substringAfterLast('.', "")
        return ext in TextLikeExtensions || SuspiciousNameRegex.containsMatchIn(entryName)
    }

    private fun containsEicar(bytes: ByteArray): Boolean {
        return bytes.toString(Charsets.ISO_8859_1)
            .contains("X5O!P%@AP[4\\PZX54(P^)7CC)7}\$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!\$H+H*")
    }

    private fun severityForScore(score: Int): ThreatSeverity {
        return when {
            score >= 70 -> ThreatSeverity.High
            score >= 45 -> ThreatSeverity.Medium
            else -> ThreatSeverity.Low
        }
    }

    private fun InputStream.readLimited(maxBytes: Int): ByteArray {
        val buffer = ByteArray(16 * 1024)
        val output = ByteArrayOutputStream(maxBytes.coerceAtMost(8192))
        var total = 0

        while (total < maxBytes) {
            val count = read(buffer, 0, minOf(buffer.size, maxBytes - total))
            if (count <= 0) {
                break
            }
            output.write(buffer, 0, count)
            total += count
        }

        return output.toByteArray()
    }

    private fun sha256Hex(input: InputStream): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val buffer = ByteArray(16 * 1024)

        while (true) {
            val read = input.read(buffer)
            if (read <= 0) {
                break
            }
            digest.update(buffer, 0, read)
        }

        return digest.digest().joinToString("") { byte -> "%02x".format(byte) }
    }

    private fun File.isSamePath(pathLabel: String): Boolean {
        return runCatching {
            absolutePath == pathLabel
        }.getOrDefault(false)
    }

    private companion object {
        val SuspiciousExtensions = setOf(
            "apk",
            "apks",
            "xapk",
            "zip",
            "jar",
            "dex",
            "js",
            "vbs",
            "ps1",
            "sh",
            "bat",
            "cmd",
            "msi",
            "exe",
            "elf",
            "so",
        )

        val ArchiveExtensions = setOf(
            "apk",
            "apks",
            "xapk",
            "zip",
            "jar",
        )

        val TextLikeExtensions = setOf(
            "txt",
            "json",
            "xml",
            "html",
            "htm",
            "js",
            "bat",
            "cmd",
            "ps1",
            "vbs",
            "sh",
            "log",
            "dex",
            "apk",
            "jar",
            "zip",
            "",
        )

        val SafeMediaExtensions = setOf(
            "jpg",
            "jpeg",
            "png",
            "gif",
            "webp",
            "mp3",
            "wav",
            "ogg",
            "mp4",
            "mkv",
            "avi",
            "pdf",
            "doc",
            "docx",
            "xls",
            "xlsx",
            "ppt",
            "pptx",
        )

        val SkipDirectoryNames = setOf(
            "cache",
            ".cache",
            "tmp",
            "temp",
            ".thumbnails",
        )

        val SuspiciousNameRegex = Regex(
            pattern = "(crack|patch|keygen|loader|stealer|rat|inject|dropper|payload|miner|spy|bypass|silent|hook|hack|modmenu|overlay)",
            option = RegexOption.IGNORE_CASE,
        )

        val RiskTokens = listOf(
            RiskToken("dexclassloader", 22, "признаки динамической загрузки кода"),
            RiskToken("runtime.getruntime().exec", 22, "запуск shell-команд из приложения"),
            RiskToken("processbuilder(", 16, "использование ProcessBuilder для команд"),
            RiskToken("android.permission.bind_accessibility_service", 26, "доступ к accessibility"),
            RiskToken("android.permission.request_install_packages", 22, "запрос установки других пакетов"),
            RiskToken("android.permission.system_alert_window", 18, "рисование поверх приложений"),
            RiskToken("android.permission.receive_boot_completed", 12, "автозапуск после перезагрузки"),
            RiskToken("smsmanager", 20, "прямой доступ к отправке SMS"),
            RiskToken("sendmultiparttextmessage", 24, "отправка multipart SMS"),
            RiskToken("su -c", 22, "попытка выполнить root-команду"),
            RiskToken("frida", 22, "инструменты перехвата и инжекта"),
            RiskToken("magisk", 16, "обнаружены строки Magisk/root"),
            RiskToken("accessibilityservice", 18, "использование AccessibilityService"),
            RiskToken("keylogger", 30, "упоминание keylogger-механики"),
            RiskToken("overlay", 10, "overlay-поведение"),
        )

        val RiskyPermissions = mapOf(
            "android.permission.BIND_ACCESSIBILITY_SERVICE" to 28,
            "android.permission.REQUEST_INSTALL_PACKAGES" to 22,
            "android.permission.SYSTEM_ALERT_WINDOW" to 18,
            "android.permission.RECEIVE_BOOT_COMPLETED" to 10,
            "android.permission.SEND_SMS" to 22,
            "android.permission.RECEIVE_SMS" to 18,
            "android.permission.READ_SMS" to 16,
            "android.permission.READ_CALL_LOG" to 16,
            "android.permission.WRITE_SETTINGS" to 14,
            "android.permission.QUERY_ALL_PACKAGES" to 12,
            "android.permission.PACKAGE_USAGE_STATS" to 12,
        )

        fun isArchiveName(name: String): Boolean {
            return name.substringAfterLast('.', "").lowercase(Locale.ROOT) in ArchiveExtensions
        }
    }
}
