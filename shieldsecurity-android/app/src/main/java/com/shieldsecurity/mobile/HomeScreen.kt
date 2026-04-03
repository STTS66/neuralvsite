package com.shieldsecurity.mobile

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
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
import androidx.compose.foundation.layout.weight
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Bolt
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.PlayArrow
import androidx.compose.material.icons.outlined.TrackChanges
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.shieldsecurity.mobile.ui.components.AssetImage
import com.shieldsecurity.mobile.ui.theme.ElectricBlue
import com.shieldsecurity.mobile.ui.theme.NightBackground
import com.shieldsecurity.mobile.ui.theme.TextPrimary
import com.shieldsecurity.mobile.ui.theme.TextSecondary
import com.shieldsecurity.mobile.ui.theme.WarningAmber

private data class ModePalette(
    val cardBrush: Brush,
    val glowColor: Color,
    val iconTint: Color,
    val borderColor: Color,
)

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

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        containerColor = NightBackground,
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    brush = Brush.verticalGradient(
                        colors = listOf(
                            Color(0xFF07111D),
                            NightBackground,
                            Color(0xFF050D17),
                        ),
                    ),
                )
                .padding(padding)
                .statusBarsPadding(),
        ) {
            HomeHeader(
                isGuest = isGuest,
                isAuthenticated = isAuthenticated,
                displayName = session.displayName.ifBlank { session.email },
                onOpenHistory = onOpenHistory,
                onActionClick = onSignOut,
            )

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(scrollState)
                    .padding(horizontal = 22.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(18.dp),
            ) {
                ThreatSummaryCard(
                    scanState = state.scanState,
                    isGuest = isGuest,
                    onOpenReport = onOpenHistory,
                )

                SectionTitleCard(title = "Режимы")

                WideModeCard(
                    title = "Глубокая",
                    description = if (isAuthenticated) {
                        "Анализирует все файлы телефона и ищет вредоносные объекты."
                    } else {
                        "Доступна только после входа в аккаунт."
                    },
                    palette = deepModePalette(),
                    enabled = isAuthenticated,
                    onClick = {
                        if (isAuthenticated) {
                            onModeClick(ScanMode.Deep)
                        } else {
                            onOpenAuth()
                        }
                    },
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    CompactModeCard(
                        modifier = Modifier.weight(1f),
                        title = "Быстрая",
                        description = "Проверяет быстро и охватывает ключевые зоны.",
                        icon = {
                            Icon(
                                imageVector = Icons.Outlined.Bolt,
                                contentDescription = null,
                                tint = Color(0xFF84F1E2),
                                modifier = Modifier.size(26.dp),
                            )
                        },
                        palette = quickModePalette(),
                        onClick = { onModeClick(ScanMode.Quick) },
                    )

                    CompactModeCard(
                        modifier = Modifier.weight(1f),
                        title = "Выборочная",
                        description = "Проверяет выбранные папки, файлы и APK.",
                        icon = {
                            Icon(
                                imageVector = Icons.Outlined.TrackChanges,
                                contentDescription = null,
                                tint = Color(0xFFC7CAFF),
                                modifier = Modifier.size(24.dp),
                            )
                        },
                        palette = customModePalette(),
                        onClick = { onModeClick(ScanMode.Custom) },
                    )
                }

                ApkActionCard(
                    isAuthenticated = isAuthenticated,
                    onClick = {
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
}

@Composable
private fun HomeHeader(
    isGuest: Boolean,
    isAuthenticated: Boolean,
    displayName: String,
    onOpenHistory: () -> Unit,
    onActionClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 22.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        HeaderIconButton(onClick = onOpenHistory) {
            Icon(
                imageVector = Icons.Outlined.History,
                contentDescription = null,
                tint = TextPrimary,
                modifier = Modifier.size(24.dp),
            )
        }

        Column(
            modifier = Modifier.weight(1f),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            AssetImage(
                assetName = "logo_color0.png",
                contentDescription = "ShieldSecurity logo",
                modifier = Modifier
                    .fillMaxWidth(0.48f)
                    .height(30.dp),
            )
            Text(
                text = "ShieldSecurity",
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onSurface,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = when {
                    isGuest -> "Гостевой режим"
                    isAuthenticated -> displayName
                    else -> "Защита устройства"
                },
                style = MaterialTheme.typography.bodySmall,
                color = TextSecondary,
                textAlign = TextAlign.Center,
            )
        }

        HeaderIconButton(onClick = onActionClick) {
            AssetImage(
                assetName = "tool.png",
                contentDescription = "Настройки",
                modifier = Modifier.size(22.dp),
                colorFilter = ColorFilter.tint(TextPrimary),
            )
        }
    }
}

@Composable
private fun HeaderIconButton(
    onClick: () -> Unit,
    content: @Composable BoxScope.() -> Unit,
) {
    Surface(
        modifier = Modifier
            .size(48.dp)
            .clickable(onClick = onClick),
        shape = CircleShape,
        color = Color(0xFF111E2C),
        border = BorderStroke(1.dp, Color(0x143F7AA5)),
    ) {
        Box(contentAlignment = Alignment.Center, content = content)
    }
}

@Composable
private fun ThreatSummaryCard(
    scanState: ScanState,
    isGuest: Boolean,
    onOpenReport: () -> Unit,
) {
    Card(
        shape = RoundedCornerShape(30.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF122536)),
        border = BorderStroke(1.dp, Color(0x29456B88)),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .animateContentSize()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(
                text = scanState.threatTitle,
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onSurface,
                fontWeight = FontWeight.Bold,
            )

            StatusPill(
                iconAsset = if (scanState.isScanning) "alert-circle.png" else "shield.png",
                text = if (scanState.isScanning) "Сейчас идёт анализ" else scanState.lastScanLabel,
                tint = if (scanState.isScanning) WarningAmber else Color(0xFFFFC98A),
            )

            Text(
                text = if (isGuest && !scanState.isScanning) {
                    "В гостевом режиме быстрый и выборочный анализ доступны сразу. Для глубокой проверки сначала войдите."
                } else {
                    scanState.threatDescription
                },
                style = MaterialTheme.typography.bodyMedium,
                color = TextSecondary,
            )

            if (scanState.isScanning) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    LinearProgressIndicator(
                        progress = { scanState.progress },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(8.dp),
                        color = ElectricBlue,
                        trackColor = Color(0x223C648B),
                    )
                    Text(
                        text = scanState.stageText,
                        style = MaterialTheme.typography.bodySmall,
                        color = ElectricBlue,
                    )
                }
            }

            Button(
                onClick = onOpenReport,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(58.dp),
                shape = RoundedCornerShape(24.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFFFFBC73),
                    contentColor = Color(0xFF17120D),
                ),
            ) {
                AssetImage(
                    assetName = "alert-circle.png",
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                    colorFilter = ColorFilter.tint(Color(0xFF17120D)),
                )
                Spacer(modifier = Modifier.width(10.dp))
                Text(
                    text = "Открыть отчёт",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}

@Composable
private fun StatusPill(
    iconAsset: String,
    text: String,
    tint: Color,
) {
    Surface(
        shape = RoundedCornerShape(22.dp),
        color = Color(0xFF2B3440),
        border = BorderStroke(1.dp, Color(0x3FA28B6F)),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(28.dp)
                    .background(Color(0x2EE5B169), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                AssetImage(
                    assetName = iconAsset,
                    contentDescription = null,
                    modifier = Modifier.size(14.dp),
                    colorFilter = ColorFilter.tint(tint),
                )
            }
            Text(
                text = text,
                color = Color(0xFFF4C48D),
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium,
            )
        }
    }
}

@Composable
private fun SectionTitleCard(
    title: String,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(28.dp),
        color = Color(0xFF122536),
        border = BorderStroke(1.dp, Color(0x24456B88)),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 26.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onSurface,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

@Composable
private fun WideModeCard(
    title: String,
    description: String,
    palette: ModePalette,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(30.dp),
        color = Color.Transparent,
        border = BorderStroke(1.dp, palette.borderColor),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(palette.cardBrush)
                .padding(horizontal = 18.dp, vertical = 20.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            ModeIconCircle(
                glowColor = palette.glowColor.copy(alpha = 0.16f),
            ) {
                AssetImage(
                    assetName = "shield.png",
                    contentDescription = null,
                    modifier = Modifier.size(28.dp),
                    colorFilter = ColorFilter.tint(palette.iconTint),
                )
            }

            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.headlineMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                    fontWeight = FontWeight.ExtraBold,
                )
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextSecondary,
                )
                if (!enabled) {
                    Text(
                        text = "Требуется вход",
                        style = MaterialTheme.typography.labelLarge,
                        color = WarningAmber,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }

            PlayCircle(
                background = palette.glowColor.copy(alpha = 0.16f),
                tint = palette.iconTint,
            )
        }
    }
}

@Composable
private fun CompactModeCard(
    modifier: Modifier = Modifier,
    title: String,
    description: String,
    icon: @Composable BoxScope.() -> Unit,
    palette: ModePalette,
    onClick: () -> Unit,
) {
    Surface(
        modifier = modifier.clickable(onClick = onClick),
        shape = RoundedCornerShape(30.dp),
        color = Color.Transparent,
        border = BorderStroke(1.dp, palette.borderColor),
    ) {
        Column(
            modifier = Modifier
                .background(palette.cardBrush)
                .padding(horizontal = 16.dp, vertical = 22.dp),
            horizontalAlignment = Alignment.Start,
            verticalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            ModeIconCircle(
                glowColor = palette.glowColor.copy(alpha = 0.12f),
                size = 74.dp,
                content = icon,
            )

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.headlineSmall,
                    color = MaterialTheme.colorScheme.onSurface,
                    fontWeight = FontWeight.ExtraBold,
                )
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondary,
                )
            }

            PlayCircle(
                background = palette.glowColor.copy(alpha = 0.18f),
                tint = palette.iconTint,
            )
        }
    }
}

@Composable
private fun ModeIconCircle(
    glowColor: Color,
    size: androidx.compose.ui.unit.Dp = 76.dp,
    content: @Composable BoxScope.() -> Unit,
) {
    Box(
        modifier = Modifier
            .size(size)
            .background(glowColor, CircleShape),
        contentAlignment = Alignment.Center,
        content = content,
    )
}

@Composable
private fun PlayCircle(
    background: Color,
    tint: Color,
) {
    Box(
        modifier = Modifier
            .size(92.dp)
            .background(background, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier = Modifier
                .size(64.dp)
                .background(tint.copy(alpha = 0.16f), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = Icons.Outlined.PlayArrow,
                contentDescription = null,
                tint = tint,
                modifier = Modifier.size(28.dp),
            )
        }
    }
}

@Composable
private fun ApkActionCard(
    isAuthenticated: Boolean,
    onClick: () -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(28.dp),
        color = Color(0xFF122536),
        border = BorderStroke(1.dp, Color(0x24456B88)),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 18.dp, vertical = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .background(Color(0x202A3D7A), RoundedCornerShape(14.dp)),
                contentAlignment = Alignment.Center,
            ) {
                AssetImage(
                    assetName = "file.png",
                    contentDescription = null,
                    modifier = Modifier.size(20.dp),
                    colorFilter = ColorFilter.tint(Color(0xFFC9D0FF)),
                )
            }

            Text(
                text = "Проверить APK",
                modifier = Modifier.weight(1f),
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onSurface,
                fontWeight = FontWeight.Bold,
            )

            Button(
                onClick = onClick,
                shape = RoundedCornerShape(20.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFFC9CDFF),
                    contentColor = Color(0xFF1A1D36),
                ),
            ) {
                Text(
                    text = if (isAuthenticated) "Выбрать" else "Вход",
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}

private fun deepModePalette(): ModePalette {
    return ModePalette(
        cardBrush = Brush.linearGradient(
            colors = listOf(
                Color(0xFF17354D),
                Color(0xFF1F4260),
            ),
        ),
        glowColor = Color(0xFF446A85),
        iconTint = Color(0xFFDEE7F4),
        borderColor = Color(0x5A95C8E6),
    )
}

private fun quickModePalette(): ModePalette {
    return ModePalette(
        cardBrush = Brush.verticalGradient(
            colors = listOf(
                Color(0xFF15323B),
                Color(0xFF112A34),
            ),
        ),
        glowColor = Color(0xFF2E6E69),
        iconTint = Color(0xFF84F1E2),
        borderColor = Color(0x4A63B7B0),
    )
}

private fun customModePalette(): ModePalette {
    return ModePalette(
        cardBrush = Brush.verticalGradient(
            colors = listOf(
                Color(0xFF1C2740),
                Color(0xFF222D47),
            ),
        ),
        glowColor = Color(0xFF575F93),
        iconTint = Color(0xFFC7CAFF),
        borderColor = Color(0x4A7F90D6),
    )
}
