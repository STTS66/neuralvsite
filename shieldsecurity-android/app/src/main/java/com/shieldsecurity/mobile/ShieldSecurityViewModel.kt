package com.shieldsecurity.mobile

import android.app.Application
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.MutablePreferences
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.roundToInt

private val Application.sessionStore by preferencesDataStore(name = "shieldsecurity_session")

private const val DemoCode = "111111"

enum class AuthMode {
    Login,
    Register,
}

enum class AccessLevel {
    None,
    Guest,
    Authenticated,
}

enum class VerificationPurpose {
    Login,
    Register,
}

enum class ScanMode(val title: String, val description: String) {
    Quick(
        title = "Быстрая",
        description = "Проверяет загрузки, APK и недавние изменения за короткое время.",
    ),
    Deep(
        title = "Глубокая",
        description = "Анализирует все доступные файлы телефона и ищет вредоносные объекты.",
    ),
    Custom(
        title = "Выборочная",
        description = "Проверяет только выбранные папки, документы и APK-файлы.",
    ),
}

data class SessionState(
    val isLoading: Boolean = true,
    val accessLevel: AccessLevel = AccessLevel.None,
    val displayName: String = "",
    val email: String = "",
)

data class PendingVerification(
    val purpose: VerificationPurpose,
    val email: String,
    val displayName: String,
)

data class ScanRecord(
    val id: Long,
    val title: String,
    val subtitle: String,
    val finishedAt: String,
    val durationLabel: String,
    val threatCount: Int,
)

data class ScanState(
    val isScanning: Boolean = false,
    val mode: ScanMode? = null,
    val progress: Float = 0f,
    val stageText: String = "",
    val threatTitle: String = "Угроз не обнаружено",
    val threatDescription: String = "ShieldSecurity следит за системой и пока не нашёл подозрительных файлов.",
    val lastScanLabel: String = "Последняя: проверки ещё не было",
)

data class ShieldSecurityUiState(
    val session: SessionState = SessionState(),
    val authMode: AuthMode = AuthMode.Login,
    val loginEmail: String = "",
    val loginPassword: String = "",
    val registerName: String = "",
    val registerEmail: String = "",
    val registerPassword: String = "",
    val registerPasswordRepeat: String = "",
    val showLoginPassword: Boolean = false,
    val showRegisterPassword: Boolean = false,
    val showRegisterRepeatPassword: Boolean = false,
    val pendingVerification: PendingVerification? = null,
    val verificationCode: String = "",
    val isAuthLoading: Boolean = false,
    val authError: String? = null,
    val authInfo: String? = null,
    val scanState: ScanState = ScanState(),
    val history: List<ScanRecord> = emptyList(),
)

class ShieldSecurityViewModel(
    application: Application,
) : AndroidViewModel(application) {

    private val _uiState = MutableStateFlow(ShieldSecurityUiState())
    val uiState: StateFlow<ShieldSecurityUiState> = _uiState.asStateFlow()

    private val accessLevelKey = stringPreferencesKey("access_level")
    private val displayNameKey = stringPreferencesKey("display_name")
    private val emailKey = stringPreferencesKey("email")

    init {
        viewModelScope.launch {
            restoreSession()
        }
    }

    fun updateLoginEmail(value: String) {
        _uiState.update { it.copy(loginEmail = value, authError = null) }
    }

    fun updateLoginPassword(value: String) {
        _uiState.update { it.copy(loginPassword = value, authError = null) }
    }

    fun updateRegisterName(value: String) {
        _uiState.update { it.copy(registerName = value, authError = null) }
    }

    fun updateRegisterEmail(value: String) {
        _uiState.update { it.copy(registerEmail = value, authError = null) }
    }

    fun updateRegisterPassword(value: String) {
        _uiState.update { it.copy(registerPassword = value, authError = null) }
    }

    fun updateRegisterPasswordRepeat(value: String) {
        _uiState.update { it.copy(registerPasswordRepeat = value, authError = null) }
    }

    fun updateVerificationCode(value: String) {
        _uiState.update { it.copy(verificationCode = value.filter(Char::isDigit).take(6), authError = null) }
    }

    fun setAuthMode(mode: AuthMode) {
        _uiState.update {
            it.copy(
                authMode = mode,
                authError = null,
                authInfo = null,
                pendingVerification = null,
                verificationCode = "",
            )
        }
    }

    fun toggleLoginPasswordVisibility() {
        _uiState.update { it.copy(showLoginPassword = !it.showLoginPassword) }
    }

    fun toggleRegisterPasswordVisibility() {
        _uiState.update { it.copy(showRegisterPassword = !it.showRegisterPassword) }
    }

    fun toggleRegisterRepeatPasswordVisibility() {
        _uiState.update { it.copy(showRegisterRepeatPassword = !it.showRegisterRepeatPassword) }
    }

    fun showForgotPasswordHint() {
        _uiState.update {
            it.copy(
                authError = null,
                authInfo = "Восстановление пароля добавим после подключения почтового API для мобильного приложения.",
            )
        }
    }

    fun continueAsGuest() {
        viewModelScope.launch {
            persistSession(
                accessLevel = AccessLevel.Guest,
                displayName = "Гость",
                email = "",
            )
            _uiState.update {
                it.copy(
                    session = SessionState(
                        isLoading = false,
                        accessLevel = AccessLevel.Guest,
                        displayName = "Гость",
                        email = "",
                    ),
                    authError = null,
                    authInfo = "Гостевой режим включён. Глубокая проверка и APK-анализ потребуют вход.",
                )
            }
        }
    }

    fun submitLogin() {
        val state = _uiState.value
        val email = state.loginEmail.trim()
        val password = state.loginPassword

        val validationError = validateEmail(email)
            ?: validatePassword(password)

        if (validationError != null) {
            _uiState.update { it.copy(authError = validationError, authInfo = null) }
            return
        }

        beginVerification(
            purpose = VerificationPurpose.Login,
            email = email,
            displayName = displayNameFromEmail(email),
        )
    }

    fun submitRegistration() {
        val state = _uiState.value
        val name = state.registerName.trim()
        val email = state.registerEmail.trim()
        val password = state.registerPassword
        val passwordRepeat = state.registerPasswordRepeat

        val validationError = when {
            name.length < 2 -> "Имя должно быть не короче 2 символов."
            validateEmail(email) != null -> validateEmail(email)
            validatePassword(password) != null -> validatePassword(password)
            password != passwordRepeat -> "Пароли должны совпадать."
            else -> null
        }

        if (validationError != null) {
            _uiState.update { it.copy(authError = validationError, authInfo = null) }
            return
        }

        beginVerification(
            purpose = VerificationPurpose.Register,
            email = email,
            displayName = name,
        )
    }

    fun confirmVerification() {
        val state = _uiState.value
        val pending = state.pendingVerification ?: return

        if (state.verificationCode.length != 6) {
            _uiState.update { it.copy(authError = "Введите 6 цифр из письма.", authInfo = null) }
            return
        }

        if (state.verificationCode != DemoCode) {
            _uiState.update { it.copy(authError = "Код неверный. Для прототипа используйте 111111.") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isAuthLoading = true, authError = null) }
            delay(500)

            persistSession(
                accessLevel = AccessLevel.Authenticated,
                displayName = pending.displayName,
                email = pending.email,
            )

            _uiState.update {
                it.copy(
                    session = SessionState(
                        isLoading = false,
                        accessLevel = AccessLevel.Authenticated,
                        displayName = pending.displayName,
                        email = pending.email,
                    ),
                    pendingVerification = null,
                    verificationCode = "",
                    isAuthLoading = false,
                    authError = null,
                    authInfo = "Вход подтверждён. Можно запускать глубокую проверку и APK-анализ.",
                )
            }
        }
    }

    fun signOut() {
        viewModelScope.launch {
            persistSession(AccessLevel.None, "", "")
            _uiState.update {
                it.copy(
                    session = SessionState(
                        isLoading = false,
                        accessLevel = AccessLevel.None,
                        displayName = "",
                        email = "",
                    ),
                    pendingVerification = null,
                    verificationCode = "",
                    authError = null,
                    authInfo = null,
                    loginPassword = "",
                    registerPassword = "",
                    registerPasswordRepeat = "",
                )
            }
        }
    }

    fun startScan(mode: ScanMode): Boolean {
        if (mode == ScanMode.Deep && _uiState.value.session.accessLevel != AccessLevel.Authenticated) {
            _uiState.update {
                it.copy(
                    authInfo = "Для глубокой проверки сначала войдите в аккаунт.",
                    authError = null,
                )
            }
            return false
        }

        if (_uiState.value.scanState.isScanning) {
            return true
        }

        runScan(
            title = mode.title,
            subtitle = when (mode) {
                ScanMode.Quick -> "Проверены загрузки, APK и ключевые каталоги."
                ScanMode.Deep -> "Проверены доступные файлы телефона и системные зоны."
                ScanMode.Custom -> "Проверены выбранные разделы и пользовательские файлы."
            },
            mode = mode,
        )
        return true
    }

    fun startApkCheck(fileName: String): Boolean {
        if (_uiState.value.session.accessLevel != AccessLevel.Authenticated) {
            _uiState.update {
                it.copy(
                    authInfo = "Для APK-анализа нужен вход в аккаунт.",
                    authError = null,
                )
            }
            return false
        }

        if (_uiState.value.scanState.isScanning) {
            return true
        }

        runScan(
            title = "Проверка APK",
            subtitle = "Файл $fileName проверен сигнатурно и поведенчески.",
            mode = ScanMode.Custom,
        )
        return true
    }

    private fun beginVerification(
        purpose: VerificationPurpose,
        email: String,
        displayName: String,
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isAuthLoading = true, authError = null, authInfo = null) }
            delay(700)
            _uiState.update {
                it.copy(
                    isAuthLoading = false,
                    pendingVerification = PendingVerification(
                        purpose = purpose,
                        email = email,
                        displayName = displayName,
                    ),
                    verificationCode = "",
                    authInfo = "Код отправлен на $email. Для прототипа используйте 111111.",
                )
            }
        }
    }

    private fun runScan(
        title: String,
        subtitle: String,
        mode: ScanMode,
    ) {
        viewModelScope.launch {
            val startedAt = System.currentTimeMillis()
            val stages = when (mode) {
                ScanMode.Quick -> listOf(
                    "Подготавливаем быстрый анализ...",
                    "Проверяем недавние загрузки...",
                    "Сверяем сигнатуры APK...",
                    "Финализируем результат...",
                )
                ScanMode.Deep -> listOf(
                    "Запускаем глубокий обход файлов...",
                    "Анализируем каталоги телефона...",
                    "Ищем вредоносные паттерны и эвристики...",
                    "Собираем итоговый отчёт...",
                )
                ScanMode.Custom -> listOf(
                    "Подготавливаем выборочную проверку...",
                    "Считываем выбранные объекты...",
                    "Сравниваем контрольные суммы и поведение...",
                    "Формируем результат проверки...",
                )
            }

            _uiState.update {
                it.copy(
                    scanState = it.scanState.copy(
                        isScanning = true,
                        mode = mode,
                        progress = 0f,
                        stageText = stages.first(),
                        threatTitle = "Идёт проверка",
                        threatDescription = "ShieldSecurity плавно анализирует устройство и APK-файлы.",
                    ),
                )
            }

            stages.forEachIndexed { index, stage ->
                _uiState.update {
                    it.copy(
                        scanState = it.scanState.copy(
                            stageText = stage,
                            progress = (index / stages.size.toFloat()).coerceIn(0f, 0.95f),
                        ),
                    )
                }
                delay(700)
            }

            val durationMs = System.currentTimeMillis() - startedAt
            val record = ScanRecord(
                id = startedAt,
                title = title,
                subtitle = subtitle,
                finishedAt = formatNow(),
                durationLabel = "${(durationMs / 1000f).roundToInt()} сек",
                threatCount = 0,
            )

            _uiState.update {
                it.copy(
                    history = listOf(record) + it.history,
                    scanState = it.scanState.copy(
                        isScanning = false,
                        mode = mode,
                        progress = 1f,
                        stageText = "Проверка завершена",
                        threatTitle = "Угроз не обнаружено",
                        threatDescription = subtitle,
                        lastScanLabel = "Последняя: ${record.finishedAt}",
                    ),
                )
            }
        }
    }

    private suspend fun restoreSession() {
        val preferences = getApplication<Application>().sessionStore.data.first()
        val accessLevel = preferences[accessLevelKey]?.toAccessLevel() ?: AccessLevel.None
        val displayName = preferences[displayNameKey].orEmpty()
        val email = preferences[emailKey].orEmpty()

        _uiState.update {
            it.copy(
                session = SessionState(
                    isLoading = false,
                    accessLevel = accessLevel,
                    displayName = displayName,
                    email = email,
                ),
            )
        }
    }

    private suspend fun persistSession(
        accessLevel: AccessLevel,
        displayName: String,
        email: String,
    ) {
        getApplication<Application>().sessionStore.edit { prefs: MutablePreferences ->
            prefs[accessLevelKey] = accessLevel.name
            prefs[displayNameKey] = displayName
            prefs[emailKey] = email
        }
    }

    private fun validateEmail(email: String): String? {
        return if (Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$").matches(email)) {
            null
        } else {
            "Введите корректную почту."
        }
    }

    private fun validatePassword(password: String): String? {
        return when {
            password.length < 6 -> "Пароль должен быть не короче 6 символов."
            else -> null
        }
    }

    private fun String.toAccessLevel(): AccessLevel {
        return runCatching { AccessLevel.valueOf(this) }.getOrDefault(AccessLevel.None)
    }

    private fun displayNameFromEmail(email: String): String {
        return email.substringBefore("@").replaceFirstChar { char ->
            if (char.isLowerCase()) char.titlecase(Locale.getDefault()) else char.toString()
        }
    }

    private fun formatNow(): String {
        return SimpleDateFormat("dd.MM.yyyy · HH:mm", Locale("ru")).format(Date())
    }
}
