# Servidor HTTP via TcpListener (sem necessidade de admin)
$port = if ($env:PORT) { [int]$env:PORT } else { 8080 }
$root = "C:\Users\USER\Documents\Projetos\gestescolar"

$mimeTypes = @{
    '.html' = 'text/html; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.js'   = 'application/javascript; charset=utf-8'
    '.json' = 'application/json'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.ico'  = 'image/x-icon'
    '.svg'  = 'image/svg+xml'
    '.woff2'= 'font/woff2'
}

$tcpListener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $port)
$tcpListener.Start()
Write-Output "GestEscolar listening on http://localhost:$port/"
[Console]::Out.Flush()

while ($true) {
    $client = $tcpListener.AcceptTcpClient()
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $writer = New-Object System.IO.StreamWriter($stream)
    $writer.AutoFlush = $false

    try {
        $requestLine = $reader.ReadLine()
        if ($requestLine -match '^(GET|HEAD)\s+(\S+)\s+HTTP') {
            $urlPath = $Matches[2] -replace '\?.*', ''
            $urlPath = [System.Uri]::UnescapeDataString($urlPath).TrimStart('/')
            if ($urlPath -eq '') { $urlPath = 'index.html' }
            $filePath = Join-Path $root $urlPath

            if ((Test-Path $filePath -PathType Leaf)) {
                $ext   = [System.IO.Path]::GetExtension($filePath).ToLower()
                $mime  = if ($mimeTypes[$ext]) { $mimeTypes[$ext] } else { 'application/octet-stream' }
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $header = "HTTP/1.1 200 OK`r`nContent-Type: $mime`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`n`r`n"
                $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
                $stream.Write($headerBytes, 0, $headerBytes.Length)
                $stream.Write($bytes, 0, $bytes.Length)
            } else {
                $index = Join-Path $root 'index.html'
                $bytes = [System.IO.File]::ReadAllBytes($index)
                $header = "HTTP/1.1 200 OK`r`nContent-Type: text/html; charset=utf-8`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`n`r`n"
                $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
                $stream.Write($headerBytes, 0, $headerBytes.Length)
                $stream.Write($bytes, 0, $bytes.Length)
            }
        }
    } catch {}
    finally {
        try { $stream.Flush() } catch {}
        try { $client.Close() } catch {}
    }
}
