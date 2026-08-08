Add-Type -AssemblyName System.Drawing

$dir = Join-Path $PSScriptRoot "..\src-tauri\icons"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

function New-Rect([int]$x, [int]$y, [int]$w, [int]$h) {
    return New-Object System.Drawing.Rectangle($x, $y, $w, $h)
}

function New-AgamizIcon([int]$size, [string]$path) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)

    # Dark rounded-square canvas
    $r = [int]($size * 0.22)
    $rad = $r * 2
    $round = $size - $rad
    $canvas = New-Object System.Drawing.Drawing2D.GraphicsPath
    $r1 = New-Rect 0 0 $rad $rad
    $r2 = New-Rect $round 0 $rad $rad
    $r3 = New-Rect $round $round $rad $rad
    $r4 = New-Rect 0 $round $rad $rad
    $canvas.AddArc($r1, 180, 90) | Out-Null
    $canvas.AddArc($r2, 270, 90) | Out-Null
    $canvas.AddArc($r3, 0, 90) | Out-Null
    $canvas.AddArc($r4, 90, 90) | Out-Null
    $canvas.CloseFigure()

    $pt0 = New-Object System.Drawing.PointF(0, 0)
    $pt1 = New-Object System.Drawing.PointF($size, $size)
    $c0 = [System.Drawing.Color]::FromArgb(255, 11, 15, 23)
    $c1 = [System.Drawing.Color]::FromArgb(255, 17, 24, 39)
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($pt0, $pt1, $c0, $c1)
    $g.FillPath($bgBrush, $canvas) | Out-Null
    $bgBrush.Dispose()

    # Emerald glow pill (top-right)
    $glow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(110, 16, 185, 129))
    $g.FillEllipse($glow, [float](0.60 * $size), [float](0.08 * $size), [float](0.30 * $size), [float](0.30 * $size)) | Out-Null
    $glow.Dispose()

    # Lightning bolt as connected segments
    $b = [float](0.20 * $size)
    $w = [float](0.17 * $size)
    $boltPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 16, 185, 129), [float](0.055 * $size))
    $boltPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $boltPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $boltPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

    $pts = [System.Drawing.PointF[]]@(
        (New-Object System.Drawing.PointF($b + 0.8 * $w, $b + 0.2 * $w)),
        (New-Object System.Drawing.PointF($b + 2.6 * $w, $b + 2.6 * $w)),
        (New-Object System.Drawing.PointF($b + 1.6 * $w, $b + 2.6 * $w)),
        (New-Object System.Drawing.PointF($b + 3.6 * $w, $size - $b)),
        (New-Object System.Drawing.PointF($b + 2.0 * $w, $size - $b)),
        (New-Object System.Drawing.PointF($b, $b + 0.9 * $w))
    )
    $g.DrawLines($boltPen, $pts) | Out-Null
    $boltPen.Dispose()

    $g.Dispose()
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png) | Out-Null
    $bmp.Dispose()
    $canvas.Dispose()
}

New-AgamizIcon 32 "$dir\32x32.png"
New-AgamizIcon 128 "$dir\128x128.png"
New-AgamizIcon 256 "$dir\128x128@2x.png"

# ---- ICO (single 256x256 PNG-embedded entry) ----
$pngBytes = [System.IO.File]::ReadAllBytes("$dir\128x128@2x.png")

$ico = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($ico)
$bw.Write([uint16]0)                 # reserved
$bw.Write([uint16]1)                 # type: icon
$bw.Write([uint16]1)                 # count
$bw.Write([byte]0)                   # width 0 => 256
$bw.Write([byte]0)                   # height 0 => 256
$bw.Write([byte]0)                   # color count
$bw.Write([byte]0)                   # reserved
$bw.Write([uint16]1)                 # planes
$bw.Write([uint16]32)                # bpp
$bw.Write([uint32]$pngBytes.Length)  # size
$bw.Write([uint32]22)                # offset (6 + 16)
$bw.Write($pngBytes)
$bw.Flush()
[System.IO.File]::WriteAllBytes("$dir\icon.ico", $ico.ToArray())
$bw.Dispose()
$ico.Dispose()

if (-not (Test-Path "$dir\icon.icns")) {
    [System.IO.File]::WriteAllBytes("$dir\icon.icns", [byte[]]@())
}

Write-Output "Icons written to $dir"
Get-ChildItem $dir | Select-Object Name, Length