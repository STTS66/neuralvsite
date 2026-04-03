package com.shieldsecurity.mobile

import androidx.compose.animation.AnimatedContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Login
import androidx.compose.material.icons.outlined.MailOutline
import androidx.compose.material.icons.outlined.PersonOutline
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.shieldsecurity.mobile.ui.components.OtpCodeField
import com.shieldsecurity.mobile.ui.theme.DangerRed
import com.shieldsecurity.mobile.ui.theme.ElectricBlue

@Composable
fun AuthenticationScreen(
    state: ShieldSecurityUiState,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onLoginSubmit: () -> Unit,
    onSwitchToRegister: () -> Unit,
    onForgotPassword: () -> Unit,
    onRegisterNameChange: (String) -> Unit,
    onRegisterEmailChange: (String) -> Unit,
    onRegisterPasswordChange: (String) -> Unit,
    onRegisterRepeatPasswordChange: (String) -> Unit,
    onRegisterSubmit: () -> Unit,
    onSwitchToLogin: () -> Unit,
    onContinueAsGuest: () -> Unit,
    onToggleLoginPassword: () -> Unit,
    onToggleRegisterPassword: () -> Unit,
    onToggleRegisterRepeatPassword: () -> Unit,
    onVerificationCodeChange: (String) -> Unit,
    onVerificationSubmit: () -> Unit,
) {
    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .navigationBarsPadding()
            .verticalScroll(scrollState)
            .padding(horizontal = 22.dp, vertical = 24.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = Color(0xCC0D2235),
            shape = RoundedCornerShape(30.dp),
            tonalElevation = 0.dp,
            shadowElevation = 0.dp,
            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x1A9BD7FF)),
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(18.dp),
            ) {
                if (!state.authError.isNullOrBlank()) {
                    StatusBanner(
                        text = state.authError.orEmpty(),
                        containerColor = DangerRed.copy(alpha = 0.14f),
                        contentColor = DangerRed,
                    )
                }

                AnimatedContent(
                    targetState = when {
                        state.pendingVerification != null -> "verify"
                        state.authMode == AuthMode.Login -> "login"
                        else -> "register"
                    },
                    label = "auth-content",
                ) { step ->
                    when (step) {
                        "verify" -> VerificationCard(
                            state = state,
                            onCodeChange = onVerificationCodeChange,
                            onSubmit = onVerificationSubmit,
                        )

                        "register" -> RegisterCard(
                            state = state,
                            onNameChange = onRegisterNameChange,
                            onEmailChange = onRegisterEmailChange,
                            onPasswordChange = onRegisterPasswordChange,
                            onRepeatPasswordChange = onRegisterRepeatPasswordChange,
                            onSubmit = onRegisterSubmit,
                            onSwitchToLogin = onSwitchToLogin,
                            onTogglePassword = onToggleRegisterPassword,
                            onToggleRepeatPassword = onToggleRegisterRepeatPassword,
                        )

                        else -> LoginCard(
                            state = state,
                            onEmailChange = onEmailChange,
                            onPasswordChange = onPasswordChange,
                            onSubmit = onLoginSubmit,
                            onSwitchToRegister = onSwitchToRegister,
                            onForgotPassword = onForgotPassword,
                            onContinueAsGuest = onContinueAsGuest,
                            onTogglePassword = onToggleLoginPassword,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun LoginCard(
    state: ShieldSecurityUiState,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onSubmit: () -> Unit,
    onSwitchToRegister: () -> Unit,
    onForgotPassword: () -> Unit,
    onContinueAsGuest: () -> Unit,
    onTogglePassword: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text(
            text = "Вход",
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onSurface,
            fontWeight = FontWeight.Bold,
        )

        ShieldTextField(
            value = state.loginEmail,
            onValueChange = onEmailChange,
            label = "Почта",
            placeholder = "mail@example.com",
            leadingIcon = {
                Icon(Icons.Outlined.MailOutline, contentDescription = null)
            },
            keyboardType = KeyboardType.Email,
        )

        ShieldPasswordField(
            value = state.loginPassword,
            onValueChange = onPasswordChange,
            label = "Пароль",
            visible = state.showLoginPassword,
            onToggleVisibility = onTogglePassword,
        )

        Button(
            onClick = onSubmit,
            modifier = Modifier
                .fillMaxWidth()
                .height(54.dp),
            shape = RoundedCornerShape(18.dp),
            enabled = !state.isAuthLoading,
        ) {
            if (state.isAuthLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    color = MaterialTheme.colorScheme.onPrimary,
                    strokeWidth = 2.5.dp,
                )
            } else {
                Text("Продолжить")
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TextButton(onClick = onSwitchToRegister) {
                Text("Нет аккаунта?")
            }
            TextButton(onClick = onForgotPassword) {
                Text("Забыли пароль?")
            }
        }

        OutlinedButton(
            onClick = onContinueAsGuest,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(18.dp),
        ) {
            Icon(Icons.Outlined.Login, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Войти в гостевом режиме")
        }

        if (!state.authInfo.isNullOrBlank()) {
            Text(
                text = state.authInfo.orEmpty(),
                color = ElectricBlue,
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}

@Composable
private fun RegisterCard(
    state: ShieldSecurityUiState,
    onNameChange: (String) -> Unit,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onRepeatPasswordChange: (String) -> Unit,
    onSubmit: () -> Unit,
    onSwitchToLogin: () -> Unit,
    onTogglePassword: () -> Unit,
    onToggleRepeatPassword: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text(
            text = "Регистрация",
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onSurface,
            fontWeight = FontWeight.Bold,
        )

        ShieldTextField(
            value = state.registerName,
            onValueChange = onNameChange,
            label = "Имя",
            placeholder = "Ваше имя",
            leadingIcon = {
                Icon(Icons.Outlined.PersonOutline, contentDescription = null)
            },
            capitalization = KeyboardCapitalization.Words,
        )

        ShieldTextField(
            value = state.registerEmail,
            onValueChange = onEmailChange,
            label = "Почта",
            placeholder = "mail@example.com",
            leadingIcon = {
                Icon(Icons.Outlined.MailOutline, contentDescription = null)
            },
            keyboardType = KeyboardType.Email,
        )

        ShieldPasswordField(
            value = state.registerPassword,
            onValueChange = onPasswordChange,
            label = "Пароль",
            visible = state.showRegisterPassword,
            onToggleVisibility = onTogglePassword,
        )

        ShieldPasswordField(
            value = state.registerPasswordRepeat,
            onValueChange = onRepeatPasswordChange,
            label = "Повтор пароля",
            visible = state.showRegisterRepeatPassword,
            onToggleVisibility = onToggleRepeatPassword,
        )

        Button(
            onClick = onSubmit,
            modifier = Modifier
                .fillMaxWidth()
                .height(54.dp),
            shape = RoundedCornerShape(18.dp),
            enabled = !state.isAuthLoading,
        ) {
            if (state.isAuthLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    color = MaterialTheme.colorScheme.onPrimary,
                    strokeWidth = 2.5.dp,
                )
            } else {
                Text("Создать аккаунт")
            }
        }

        TextButton(
            onClick = onSwitchToLogin,
            modifier = Modifier.align(Alignment.CenterHorizontally),
        ) {
            Text("Есть аккаунт?")
        }

        if (!state.authInfo.isNullOrBlank()) {
            Text(
                text = state.authInfo.orEmpty(),
                color = ElectricBlue,
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}

@Composable
private fun VerificationCard(
    state: ShieldSecurityUiState,
    onCodeChange: (String) -> Unit,
    onSubmit: () -> Unit,
) {
    val pending = state.pendingVerification ?: return

    Column(verticalArrangement = Arrangement.spacedBy(18.dp)) {
        Text(
            text = "Введите код из письма",
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onSurface,
            fontWeight = FontWeight.Bold,
        )
        Text(
            text = "Для ${pending.email} отправлен 6-значный код. После подтверждения откроется главная страница.",
            color = Color(0xFFA8BFD7),
            style = MaterialTheme.typography.bodyMedium,
        )

        OtpCodeField(
            value = state.verificationCode,
            onValueChange = onCodeChange,
        )

        Text(
            text = "В прототипе используйте код 111111.",
            color = ElectricBlue,
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center,
        )

        Button(
            onClick = onSubmit,
            modifier = Modifier
                .fillMaxWidth()
                .height(54.dp),
            shape = RoundedCornerShape(18.dp),
            enabled = !state.isAuthLoading,
        ) {
            if (state.isAuthLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    color = MaterialTheme.colorScheme.onPrimary,
                    strokeWidth = 2.5.dp,
                )
            } else {
                Text("Подтвердить")
            }
        }
    }
}

@Composable
private fun ShieldTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    placeholder: String,
    leadingIcon: @Composable (() -> Unit)? = null,
    keyboardType: KeyboardType = KeyboardType.Text,
    capitalization: KeyboardCapitalization = KeyboardCapitalization.None,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = Modifier.fillMaxWidth(),
        label = { Text(label) },
        placeholder = { Text(placeholder) },
        leadingIcon = leadingIcon,
        singleLine = true,
        shape = RoundedCornerShape(18.dp),
        keyboardOptions = KeyboardOptions(
            keyboardType = keyboardType,
            capitalization = capitalization,
        ),
    )
}

@Composable
private fun ShieldPasswordField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    visible: Boolean,
    onToggleVisibility: () -> Unit,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = Modifier.fillMaxWidth(),
        label = { Text(label) },
        singleLine = true,
        shape = RoundedCornerShape(18.dp),
        visualTransformation = if (visible) VisualTransformation.None else PasswordVisualTransformation(),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
        trailingIcon = {
            IconButton(onClick = onToggleVisibility) {
                Icon(
                    imageVector = if (visible) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,
                    contentDescription = null,
                )
            }
        },
    )
}

@Composable
private fun StatusBanner(
    text: String,
    containerColor: Color,
    contentColor: Color,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        color = containerColor,
    ) {
        Text(
            text = text,
            color = contentColor,
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
        )
    }
}
