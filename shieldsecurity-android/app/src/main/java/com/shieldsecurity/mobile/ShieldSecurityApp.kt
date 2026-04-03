package com.shieldsecurity.mobile

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.OpenableColumns
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.documentfile.provider.DocumentFile
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.shieldsecurity.mobile.ui.theme.ElectricBlue
import com.shieldsecurity.mobile.ui.theme.NightBackground
import com.shieldsecurity.mobile.ui.theme.TextSecondary

private enum class RootScreen {
    Auth,
    Home,
    History,
}

@Composable
fun ShieldSecurityApp(
    viewModel: ShieldSecurityViewModel = viewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var currentScreen by rememberSaveable { mutableStateOf(RootScreen.Auth.name) }
    var pendingStorageScan by rememberSaveable { mutableStateOf<String?>(null) }
    val snackbarHostState = remember { SnackbarHostState() }
    val context = androidx.compose.ui.platform.LocalContext.current

    val apkPicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent(),
    ) { uri: Uri? ->
        if (uri != null) {
            val name = resolveFileName(context, uri)
            viewModel.startApkCheck(uri, name)
        }
    }

    val treePicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocumentTree(),
    ) { uri: Uri? ->
        if (uri == null) {
            return@rememberLauncherForActivityResult
        }

        runCatching {
            context.contentResolver.takePersistableUriPermission(
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION,
            )
        }

        val folderLabel = resolveTreeName(context, uri)
        viewModel.startCustomScan(uri, folderLabel)
    }

    val legacyStoragePermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
    ) { granted ->
        val pending = pendingStorageScan?.let { runCatching { ScanMode.valueOf(it) }.getOrNull() }
        pendingStorageScan = null

        if (granted && pending != null) {
            viewModel.startScan(pending)
        } else {
            viewModel.showInfo("Без доступа к файлам быстрая и глубокая проверка не смогут прочитать хранилище.")
        }
    }

    val allFilesAccessLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult(),
    ) {
        val pending = pendingStorageScan?.let { runCatching { ScanMode.valueOf(it) }.getOrNull() }
        pendingStorageScan = null

        if (pending != null && hasBroadStorageAccess(context)) {
            viewModel.startScan(pending)
        } else if (pending != null) {
            viewModel.showInfo("Разрешение на доступ к файлам не выдано. Без него полноценная проверка не запустится.")
        }
    }

    LaunchedEffect(uiState.session.isLoading, uiState.session.accessLevel) {
        if (uiState.session.isLoading) {
            return@LaunchedEffect
        }

        if (uiState.session.accessLevel == AccessLevel.None) {
            currentScreen = RootScreen.Auth.name
        } else if (currentScreen == RootScreen.Auth.name) {
            currentScreen = RootScreen.Home.name
        }
    }

    LaunchedEffect(currentScreen, uiState.authInfo, uiState.authError) {
        if (currentScreen != RootScreen.Auth.name) {
            val message = uiState.authError ?: uiState.authInfo
            if (!message.isNullOrBlank()) {
                snackbarHostState.showSnackbar(message)
            }
        }
    }

    fun launchFileScan(mode: ScanMode) {
        if (mode == ScanMode.Custom) {
            treePicker.launch(null)
            return
        }

        if (mode == ScanMode.Deep && uiState.session.accessLevel != AccessLevel.Authenticated) {
            currentScreen = RootScreen.Auth.name
            return
        }

        if (hasBroadStorageAccess(context)) {
            viewModel.startScan(mode)
            return
        }

        pendingStorageScan = mode.name

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            viewModel.showInfo("Разрешите доступ к файлам, чтобы ${mode.title.lowercase()} проверка увидела хранилище устройства.")
            allFilesAccessLauncher.launch(createAllFilesAccessIntent(context))
        } else {
            legacyStoragePermissionLauncher.launch(Manifest.permission.READ_EXTERNAL_STORAGE)
        }
    }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        containerColor = NightBackground,
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    brush = Brush.verticalGradient(
                        colors = listOf(
                            NightBackground,
                            Color(0xFF07182A),
                            NightBackground,
                        ),
                    ),
                )
                .padding(padding),
        ) {
            AnimatedContent(
                targetState = if (uiState.session.isLoading) "splash" else currentScreen,
                label = "root-screen",
            ) { screen ->
                when (screen) {
                    "splash" -> BootScreen()

                    RootScreen.History.name -> HistoryScreen(
                        records = uiState.history,
                        onBack = { currentScreen = RootScreen.Home.name },
                    )

                    RootScreen.Home.name -> HomeScreen(
                        state = uiState,
                        onOpenHistory = { currentScreen = RootScreen.History.name },
                        onOpenAuth = { currentScreen = RootScreen.Auth.name },
                        onSignOut = {
                            viewModel.signOut()
                            currentScreen = RootScreen.Auth.name
                        },
                        onModeClick = { mode ->
                            launchFileScan(mode)
                        },
                        onApkClick = {
                            if (uiState.session.accessLevel != AccessLevel.Authenticated) {
                                currentScreen = RootScreen.Auth.name
                            } else {
                                apkPicker.launch("*/*")
                            }
                        },
                    )

                    else -> AuthenticationScreen(
                        state = uiState,
                        onEmailChange = viewModel::updateLoginEmail,
                        onPasswordChange = viewModel::updateLoginPassword,
                        onLoginSubmit = viewModel::submitLogin,
                        onSwitchToRegister = { viewModel.setAuthMode(AuthMode.Register) },
                        onForgotPassword = viewModel::showForgotPasswordHint,
                        onRegisterNameChange = viewModel::updateRegisterName,
                        onRegisterEmailChange = viewModel::updateRegisterEmail,
                        onRegisterPasswordChange = viewModel::updateRegisterPassword,
                        onRegisterRepeatPasswordChange = viewModel::updateRegisterPasswordRepeat,
                        onRegisterSubmit = viewModel::submitRegistration,
                        onSwitchToLogin = { viewModel.setAuthMode(AuthMode.Login) },
                        onContinueAsGuest = viewModel::continueAsGuest,
                        onToggleLoginPassword = viewModel::toggleLoginPasswordVisibility,
                        onToggleRegisterPassword = viewModel::toggleRegisterPasswordVisibility,
                        onToggleRegisterRepeatPassword = viewModel::toggleRegisterRepeatPasswordVisibility,
                        onVerificationCodeChange = viewModel::updateVerificationCode,
                        onVerificationSubmit = viewModel::confirmVerification,
                    )
                }
            }
        }
    }
}

@Composable
private fun BootScreen() {
    val transition = rememberInfiniteTransition(label = "boot")
    val scale by transition.animateFloat(
        initialValue = 0.92f,
        targetValue = 1.08f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 900, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "boot-scale",
    )

    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier.statusBarsPadding().navigationBarsPadding(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            Surface(
                modifier = Modifier
                    .size(94.dp)
                    .scale(scale),
                shape = androidx.compose.foundation.shape.CircleShape,
                color = Color(0x142D9CFF),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.Outlined.Shield,
                        contentDescription = null,
                        tint = ElectricBlue,
                        modifier = Modifier.size(42.dp),
                    )
                }
            }
            Text(
                text = "ShieldSecurity",
                style = MaterialTheme.typography.headlineMedium,
                color = MaterialTheme.colorScheme.onSurface,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = "Подготавливаем локальный движок проверки, историю сканов и защиту устройства.",
                color = TextSecondary,
                style = MaterialTheme.typography.bodyMedium,
                textAlign = TextAlign.Center,
            )
            Spacer(modifier = Modifier.height(2.dp))
            CircularProgressIndicator(color = ElectricBlue)
        }
    }
}

private fun hasBroadStorageAccess(context: Context): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        Environment.isExternalStorageManager()
    } else {
        ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.READ_EXTERNAL_STORAGE,
        ) == PackageManager.PERMISSION_GRANTED
    }
}

private fun createAllFilesAccessIntent(context: Context): Intent {
    return try {
        Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
            data = Uri.parse("package:${context.packageName}")
        }
    } catch (_: ActivityNotFoundException) {
        Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION)
    }
}

private fun resolveFileName(context: Context, uri: Uri): String {
    var fileName = "selected.apk"
    context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
        val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
        if (index >= 0 && cursor.moveToFirst()) {
            fileName = cursor.getString(index)
        }
    }
    return fileName
}

private fun resolveTreeName(context: Context, uri: Uri): String {
    val documentName = DocumentFile.fromTreeUri(context, uri)?.name
    if (!documentName.isNullOrBlank()) {
        return documentName
    }

    return uri.lastPathSegment
        ?.substringAfterLast(':')
        ?.replace('/', ' ')
        ?.ifBlank { "Выбранная папка" }
        ?: "Выбранная папка"
}
