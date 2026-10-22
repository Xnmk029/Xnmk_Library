[CmdletBinding(DefaultParameterSetName = 'Evaluate')]
param(
    [Parameter(ParameterSetName = 'Evaluate')]
    [string]$RequestPath = (Join-Path $PSScriptRoot 'example-request.json'),
    [Parameter(Mandatory, ParameterSetName = 'Models')]
    [switch]$ListModels
)

$ErrorActionPreference = 'Stop'
$apiKey = $env:TYPESAFE_API_KEY
if ([string]::IsNullOrWhiteSpace($apiKey)) {
    # Existing desktop processes may not inherit recently saved user variables.
    $apiKey = [Environment]::GetEnvironmentVariable('TYPESAFE_API_KEY', 'User')
}
if ([string]::IsNullOrWhiteSpace($apiKey)) {
    throw 'TYPESAFE_API_KEY is not configured in the process or Windows user environment.'
}
$headers = @{ Authorization = "Bearer $apiKey" }
$request = @{
    Uri = 'https://api.typesafe.ai/v1/models'
    Method = 'Get'
    Headers = $headers
    TimeoutSec = 60
    ErrorAction = 'Stop'
}
if (-not $ListModels) {
    $body = Get-Content -LiteralPath $RequestPath -Raw -Encoding UTF8
    $payload = $body | ConvertFrom-Json
    if (-not $payload.model -or -not $payload.questions -or
        $null -eq $payload.state) {
        throw 'Request JSON must contain model, state, and questions.'
    }
    $request.Uri = 'https://api.typesafe.ai/v1/systemone'
    $request.Method = 'Post'
    $request.ContentType = 'application/json; charset=utf-8'
    $request.Body = [Text.Encoding]::UTF8.GetBytes($body)
}
try {
    $result = Invoke-RestMethod @request
    $result | ConvertTo-Json -Depth 100
} catch {
    # Do not include request headers or credentials in diagnostic output.
    $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 'network error' }
    throw "TypeSafe request failed ($status). Check credentials, request schema, or service availability."
} finally {
    $headers.Clear()
    $apiKey = $null
}
