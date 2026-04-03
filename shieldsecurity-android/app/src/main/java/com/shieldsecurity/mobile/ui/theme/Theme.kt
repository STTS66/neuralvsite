package com.shieldsecurity.mobile.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val DarkColors = darkColorScheme(
    primary = ElectricBlue,
    onPrimary = NightBackground,
    primaryContainer = ElectricBlueDark,
    secondary = SuccessGreen,
    tertiary = WarningAmber,
    background = NightBackground,
    surface = NightSurface,
    surfaceVariant = NightSurfaceSecondary,
    onSurface = TextPrimary,
    onSurfaceVariant = TextSecondary,
    error = DangerRed,
)

@Composable
fun ShieldSecurityTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colors = DarkColors
    MaterialTheme(
        colorScheme = colors,
        typography = AppTypography,
        content = content,
    )
}
