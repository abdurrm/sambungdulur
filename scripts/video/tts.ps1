# Synthesizes the narration with the local Windows voice "Microsoft Andika" (id-ID, male).
# Runs fully offline through SAPI; no text leaves the machine.
# Usage: powershell -File scripts/video/tts.ps1 <scenes.json> <outputDir>
param(
  [Parameter(Mandatory = $true)][string]$Scenes,
  [Parameter(Mandatory = $true)][string]$OutDir
)
Add-Type -AssemblyName System.Speech
$cfg = Get-Content -Raw -Encoding UTF8 $Scenes | ConvertFrom-Json
New-Item -ItemType Directory -Force $OutDir | Out-Null
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice($cfg.voice)
$synth.Rate = -1      # slightly slower than default for clarity
$synth.Volume = 100
foreach ($s in $cfg.scenes) {
  $path = Join-Path (Resolve-Path $OutDir) ($s.id + '.wav')
  $synth.SetOutputToWaveFile($path)
  $synth.Speak($s.speak)
  $synth.SetOutputToNull()
  Write-Output ("{0}  {1:N1} KB" -f $s.id, ((Get-Item $path).Length / 1KB))
}
$synth.Dispose()
