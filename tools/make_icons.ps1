# Make app icons (PNG). Run: powershell -ExecutionPolicy Bypass -File tools\make_icons.ps1
Add-Type -AssemblyName System.Drawing
$out = Join-Path $PSScriptRoot '..\icons'
New-Item -ItemType Directory -Force $out | Out-Null

function C($r, $g, $b) { return [System.Drawing.Color]::FromArgb($r, $g, $b) }

function Make-Icon([int]$size) {
  $s = $size / 100.0
  function P($x, $y) { return New-Object System.Drawing.PointF -ArgumentList ([float]($x * $s)), ([float]($y * $s)) }
  $bmp = New-Object System.Drawing.Bitmap -ArgumentList $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear((C 143 209 106))
  $alt = New-Object System.Drawing.SolidBrush -ArgumentList (C 132 199 95)
  for ($r = 0; $r -lt 4; $r++) {
    for ($c = 0; $c -lt 4; $c++) {
      if ((($r + $c) % 2) -eq 1) { $g.FillRectangle($alt, [float]($c * 25 * $s), [float]($r * 25 * $s), [float](25 * $s), [float](25 * $s)) }
    }
  }
  $pts = [System.Drawing.PointF[]]@((P 0 37.5), (P 62.5 37.5), (P 62.5 62.5), (P 100 62.5))
  $edge = New-Object System.Drawing.Pen -ArgumentList (C 185 138 62), ([float](17 * $s))
  $edge.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $road = New-Object System.Drawing.Pen -ArgumentList (C 236 201 127), ([float](13 * $s))
  $road.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $g.DrawLines($edge, $pts)
  $g.DrawLines($road, $pts)
  $face = New-Object System.Drawing.SolidBrush -ArgumentList (C 255 138 61)
  $white = New-Object System.Drawing.SolidBrush -ArgumentList ([System.Drawing.Color]::White)
  $ink = New-Object System.Drawing.SolidBrush -ArgumentList (C 74 58 34)
  $g.FillEllipse($face, [float](10 * $s), [float](24 * $s), [float](26 * $s), [float](26 * $s))
  $g.FillEllipse($white, [float](16 * $s), [float](31 * $s), [float](6 * $s), [float](6 * $s))
  $g.FillEllipse($white, [float](25 * $s), [float](31 * $s), [float](6 * $s), [float](6 * $s))
  $g.FillEllipse($ink, [float](18 * $s), [float](33 * $s), [float](3 * $s), [float](3 * $s))
  $g.FillEllipse($ink, [float](27 * $s), [float](33 * $s), [float](3 * $s), [float](3 * $s))
  $pole = New-Object System.Drawing.Pen -ArgumentList (C 74 58 34), ([float](3 * $s))
  $g.DrawLine($pole, [float](84 * $s), [float](44 * $s), [float](84 * $s), [float](66 * $s))
  $flag = New-Object System.Drawing.SolidBrush -ArgumentList (C 255 77 77)
  $g.FillPolygon($flag, [System.Drawing.PointF[]]@((P 85 44), (P 97 49), (P 85 54)))
  $g.Dispose()
  $path = Join-Path $out ("icon-" + $size + ".png")
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Output ("saved " + $path)
}

Make-Icon 180
Make-Icon 192
Make-Icon 512
