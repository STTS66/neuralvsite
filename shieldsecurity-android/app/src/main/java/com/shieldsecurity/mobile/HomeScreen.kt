package com.shieldsecurity.mobile

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Logout
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.shieldsecurity.mobile.ui.theme.ElectricBlue
import com.shieldsecurity.mobile.ui.theme.NightBackground
import com.shieldsecurity.mobile.ui.theme.NightSurfaceSecondary
import com.shieldsecurity.mobile.ui.theme.SuccessGreen
import com.shieldsecurity.mobile.ui.theme.TextSecondary
import com.shieldsecurity.mobile.ui.theme.WarningAmber

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    state: ShieldSecurityUiState,
    onOpenHistory: () -> Unit,
    onOpenAuth: () -> Unit,
    onSignOut: () -> Unit,
    onModeClick: (ScanMode) -> Unit,
    onApkClick: () -> Unit,
) {
    val scrollState = rememberScrollState()
    val session = state.session
    val isAuthenticated = session.accessLevel == AccessLevel.Authenticated
    val isGuest = session.accessLevel == AccessLevel.Guest

    Column(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding(),
    ) {
        CenterAlignedTopAppBar(
            colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                containerColor = Color.Transparent,
                titleContentColor = MaterialTheme.colorScheme.onSurface,
            ),
            navigationIcon = {
                TextButton(onClick = onOpenHistory) {
                    Icon(Icons.Outlined.History, contentDescription = null)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("История")
                }
            },
            title = {
                Text(
                    text = "ShieldSecurity",
                    fontWeight = FontWeight.ExtraBold,
                )
            },
            actions = {
                IconButton(onClick = onSignOut) {
                    Icon(Icons.Outlined.Logout, contentDescription = "Выход")
                }
            },
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scrollState)
                .padding(horizontal = 20.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            if (isGuest) {
                HomeBanner(
                    text = "Вы в гостевом режиме. Глубокая проверка и APK-анализ доступны только после входа.",
                    containerColor = WarningAmber.copy(alpha = 0.14f),
                    contentColor = WarningAmber,
                )
            } else {
                HomeBanner(
                    text = "Аккаунт активен: ${session.displayName.ifBlank { session.email }}",
                    containerColor = SuccessGreen.copy(alpha = 0.14f),
                    contentColor = SuccessGreen,
                )
            }

            ThreatStatusCard(scanState = state.scanState)

            ScanModesCard(
                isAuthenticated = isAuthenticated,
                scanState = state.scanState,
                onModeClick = onModeClick,
            )

            ApkCard(
                isAuthenticated = isAuthenticated,
                onPrimaryAction = {
                    if (isAuthenticated) {
                        onApkClick()
                    } else {
                        onOpenAuth()
                    }
                },
            )
        }
    }
}

@Composable
private fun ThreatStatusCard(
    scanState: ScanState,
) {
    Card(
        shape = RoundedCornerShape(28.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xCC0D2235)),
        border = BorderStroke(1.dp, Color(0x169BD7FF)),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(22.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top,
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        text = "Текущий статус угроз",
                        style = MaterialTheme.typography.titleMedium,
                        color = TextSecondary,
                    )
                    Text(
                        text = scanState.threatTitle,
                        style = MaterialTheme.typography.headlineSmall,
                        color = MaterialTheme.colorScheme.onSurface,
                        fontWeight = FontWeight.Bold,
                    )
                }

                AssistChip(
                    onClick = { },
                    label = {
                        Text(if (scanState.isScanning) "Идёт анализ" else "Стабильно")
                    },
                    leadingIcon = {
                        Icon(
                            imageVector = if (scanState.isScanning) Icons.Outlined.WarningAmber else Icons.Outlined.Shield,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp),
                        )
                    },
                    colors = AssistChipDefaults.assistChipColors(
                        containerColor = if (scanState.isScanning) {
                            WarningAmber.copy(alpha = 0.18f)
                        } else {
                            SuccessGreen.copy(alpha = 0.18f)
                        },
                        labelColor = MaterialTheme.colorScheme.onSurface,
                        leadingIconContentColor = if (scanState.isScanning) WarningAmber else SuccessGreen,
                    ),
                )
            }

            Text(
                text = scanState.threatDescription,
                style = MaterialTheme.typography.bodyLarge,
                color = TextSecondary,
            )

            if (scanState.isScanning) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    LinearProgressIndicator(
                        progress = { scanState.progress },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(8.dp),
                    )
                    Text(
                        text = scanState.stageText,
                        style = MaterialTheme.typography.bodyMedium,
                        color = ElectricBlue,
                    )
                }
            }

            HorizontalDivider(color = Color(0x149BD7FF))

            Text(
                text = scanState.lastScanLabel,
                style = MaterialTheme.typography.bodySmall,
                color = TextSecondary,
            )
        }
    }
}

@Composable
private fun ScanModesCard(
    isAuthenticated: Boolean,
    scanState: ScanState,
    onModeClick: (ScanMode) -> Unit,
) {
    Card(
        shape = RoundedCornerShape(28.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xCC0D2235)),
        border = BorderStroke(1.dp, Color(0x169BD7FF)),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(22.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(
                text = "Режимы проверки",
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onSurface,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = "Глубокая анализирует все файлы телефона, быстрая проходит по ключевым зонам, а выборочная помогает проверить то, что выберете вы.",
                style = MaterialTheme.typography.bodyMedium,
                color = TextSecondary,
            )

            ScanMode.entries.forEach { mode ->
                val modeEnabled = mode != ScanMode.Deep || isAuthenticated
                val actionText = when {
                    scanState.isScanning && scanState.mode == mode -> "Выполняется..."
                    !modeEnabled -> "Вход"
                    else -> "Запустить"
                }

                androidx.compose.material3.Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(24.dp),
                    color = NightSurfaceSecondary.copy(alpha = 0.88f),
                    border = BorderStroke(
                        width = 1.dp,
                        color = if (scanState.mode == mode) ElectricBlue.copy(alpha = 0.36f) else Color.Transparent,
                    ),
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(18.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(
                                modifier = Modifier.weight(1f),
                                verticalArrangement = Arrangement.spacedBy(4.dp),
                            ) {
                                Text(
                                    text = mode.title,
                                    style = MaterialTheme.typography.titleMedium,
                                    color = MaterialTheme.colorScheme.onSurface,
                                    fontWeight = FontWeight.Bold,
                                )
                                Text(
                                    text = mode.description,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = TextSecondary,
                                )
                            }

                            if (!modeEnabled) {
                                AssistChip(
                                    onClick = { },
                                    label = { Text("Только по входу") },
                                    leadingIcon = {
                                        Icon(Icons.Outlined.Lock, contentDescription = null, modifier = Modifier.size(16.dp))
                                    },
                                )
                            }
                        }

                        FilledTonalButton(
                            onClick = { onModeClick(mode) },
                            enabled = !scanState.isScanning || scanState.mode == mode,
                            shape = RoundedCornerShape(16.dp),
                            colors = ButtonDefaults.filledTonalButtonColors(
                                containerColor = if (modeEnabled) ElectricBlue.copy(alpha = 0.16f) else Color(0x18FFFFFF),
                                contentColor = if (modeEnabled) ElectricBlue else TextSecondary,
                            ),
                        ) {
                            Text(actionText)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ApkCard(
    isAuthenticated: Boolean,
    onPrimaryAction: () -> Unit,
) {
    Card(
        shape = RoundedCornerShape(28.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xCC0D2235)),
        border = BorderStroke(1.dp, Color(0x169BD7FF)),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(22.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text(
                text = "Проверить APK",
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onSurface,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = if (isAuthenticated) {
                    "Выберите APK-файл, и ShieldSecurity проверит его сигнатуры и подозрительное поведение."
                } else {
                    "Для APK-анализа нужен аккаунт. Сейчас кнопка ведёт на вход."
                },
                style = MaterialTheme.typography.bodyMedium,
                color = TextSecondary,
            )
            Button(
                onClick = onPrimaryAction,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(18.dp),
            ) {
                Text(if (isAuthenticated) "Выбрать APK" else "Вход")
            }
        }
    }
}

@Composable
private fun HomeBanner(
    text: String,
    containerColor: Color,
    contentColor: Color,
) {
    androidx.compose.material3.Surface(
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
