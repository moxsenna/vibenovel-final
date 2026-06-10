<#
.SYNOPSIS
  Task 10.23b — Provision production EC2 + EIP (narraza-production-api).
  Requires AWS profile narraza-deploy configured. Never logs secrets.
#>
[CmdletBinding()]
param(
  [string]$Profile = "narraza-deploy",
  [string]$Region = "ap-southeast-1",
  [string]$StagingIp = "13.212.245.32",
  [string]$InstanceName = "narraza-production-api",
  [string]$KeyName = "vibenovel-staging-key",
  [string]$InstanceType = "t3.small",
  [switch]$WhatIfOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Aws = "C:\Program Files\Amazon\AWSCLIV2\aws.exe"
$env:AWS_PROFILE = $Profile
$env:AWS_DEFAULT_REGION = $Region

function Invoke-Aws {
  param([string[]]$AwsArgs)
  $all = @("--profile", $Profile, "--region", $Region) + $AwsArgs
  $out = & $Aws @all
  if ($LASTEXITCODE -ne 0) { throw "aws failed: $($AwsArgs -join ' ')" }
  return $out
}

Write-Host "AWS identity..." -ForegroundColor Cyan
$id = Invoke-Aws @("sts", "get-caller-identity", "--output", "json") | ConvertFrom-Json
Write-Host "PASS account $($id.Account) user $($id.Arn -replace 'user/.+','user/[redacted]')" -ForegroundColor Green

Write-Host "`nExisting instances..." -ForegroundColor Cyan
$instances = Invoke-Aws @(
  "ec2", "describe-instances",
  "--filters", "Name=instance-state-name,Values=running,pending,stopped",
  "--query", "Reservations[].Instances[].[InstanceId,State.Name,PublicIpAddress,Tags[?Key=='Name'].Value|[0]]",
  "--output", "json"
) | ConvertFrom-Json
foreach ($row in $instances) {
  Write-Host ("  {0} {1} ip={2} name={3}" -f $row[0], $row[1], $row[2], $row[3])
}

$existing = $instances | Where-Object { $_[3] -eq $InstanceName -and $_[1] -eq 'running' } | Select-Object -First 1
if ($existing) {
  $instanceId = $existing[0]
  Write-Host "Found running instance $instanceId" -ForegroundColor Yellow
} else {
  Write-Host "`nKey pairs..." -ForegroundColor Cyan
  $keys = Invoke-Aws @("ec2", "describe-key-pairs", "--query", "KeyPairs[].KeyName", "--output", "json") | ConvertFrom-Json
  Write-Host ("  " + ($keys -join ', '))
  if ($keys -notcontains $KeyName) {
    throw "Key pair $KeyName not found in $Region. Import staging public key or create key pair."
  }

  Write-Host "`nUbuntu 24.04 AMI..." -ForegroundColor Cyan
  $ami = Invoke-Aws @(
    "ec2", "describe-images",
    "--owners", "099720109477",
    "--filters", "Name=name,Values=ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*", "Name=state,Values=available",
    "--query", "sort_by(Images, &CreationDate)[-1].ImageId",
    "--output", "text"
  ).Trim()
  Write-Host "AMI: $ami"

  Write-Host "`nSecurity group..." -ForegroundColor Cyan
  $vpcId = Invoke-Aws @("ec2", "describe-vpcs", "--filters", "Name=isDefault,Values=true", "--query", "Vpcs[0].VpcId", "--output", "text").Trim()
  $sgName = "narraza-production-api-sg"
  $sgId = $null
  try {
    $sgId = Invoke-Aws @("ec2", "describe-security-groups", "--filters", "Name=group-name,Values=$sgName", "--query", "SecurityGroups[0].GroupId", "--output", "text").Trim()
  } catch { }
  if ([string]::IsNullOrWhiteSpace($sgId) -or $sgId -eq "None") {
    if ($WhatIfOnly) { Write-Host "Would create SG $sgName"; exit 0 }
    $sgId = Invoke-Aws @(
      "ec2", "create-security-group",
      "--group-name", $sgName,
      "--description", "Narraza production API Mode A",
      "--vpc-id", $vpcId,
      "--query", "GroupId",
      "--output", "text"
    ).Trim()
    foreach ($perm in @(
      @{ Port = 22; Desc = "SSH" },
      @{ Port = 80; Desc = "HTTP" },
      @{ Port = 443; Desc = "HTTPS" }
    )) {
      Invoke-Aws @(
        "ec2", "authorize-security-group-ingress",
        "--group-id", $sgId,
        "--protocol", "tcp",
        "--port", "$($perm.Port)",
        "--cidr", "0.0.0.0/0"
      ) | Out-Null
    }
    Write-Host "Created SG $sgId" -ForegroundColor Green
  } else {
    Write-Host "Reuse SG $sgId" -ForegroundColor Green
  }

  if ($WhatIfOnly) { Write-Host "Would launch $InstanceType with $KeyName"; exit 0 }

  Write-Host "`nLaunching instance..." -ForegroundColor Cyan
  $instanceId = Invoke-Aws @(
    "ec2", "run-instances",
    "--image-id", $ami,
    "--count", "1",
    "--instance-type", $InstanceType,
    "--key-name", $KeyName,
    "--security-group-ids", $sgId,
    "--tag-specifications", "ResourceType=instance,Tags=[{Key=Name,Value=$InstanceName}]",
    "--query", "Instances[0].InstanceId",
    "--output", "text"
  ).Trim()
  Write-Host "InstanceId: $instanceId" -ForegroundColor Green
  Invoke-Aws @("ec2", "wait", "instance-running", "--instance-ids", $instanceId) | Out-Null
}

Write-Host "`nElastic IP..." -ForegroundColor Cyan
$eipQuery = Invoke-Aws @(
  "ec2", "describe-addresses",
  "--filters", "Name=tag:Name,Values=$InstanceName-eip",
  "--query", "Addresses[0].[AllocationId,PublicIp,InstanceId]",
  "--output", "json"
)
$eipRow = $null
if ($eipQuery -and $eipQuery -ne "null") {
  try { $eipRow = ($eipQuery | ConvertFrom-Json) } catch { }
}
$eip = $null
$allocId = $null
if ($eipRow -and $eipRow.Count -ge 2 -and $eipRow[1]) {
  $allocId = $eipRow[0]
  $eip = $eipRow[1]
  Write-Host "Reuse EIP $eip" -ForegroundColor Green
} else {
  $allocId = Invoke-Aws @("ec2", "allocate-address", "--domain", "vpc", "--tag-specifications", "ResourceType=elastic-ip,Tags=[{Key=Name,Value=$InstanceName-eip}]", "--query", "AllocationId", "--output", "text").Trim()
  $eip = Invoke-Aws @("ec2", "describe-addresses", "--allocation-ids", $allocId, "--query", "Addresses[0].PublicIp", "--output", "text").Trim()
  Write-Host "Allocated EIP $eip" -ForegroundColor Green
}

$assoc = Invoke-Aws @("ec2", "describe-addresses", "--allocation-ids", $allocId, "--query", "Addresses[0].InstanceId", "--output", "text").Trim()
if ($assoc -ne $instanceId) {
  if ($assoc -and $assoc -ne "None") {
    Invoke-Aws @("ec2", "disassociate-address", "--association-id", (Invoke-Aws @("ec2", "describe-addresses", "--allocation-ids", $allocId, "--query", "Addresses[0].AssociationId", "--output", "text").Trim())) | Out-Null
  }
  Invoke-Aws @("ec2", "associate-address", "--instance-id", $instanceId, "--allocation-id", $allocId) | Out-Null
  Write-Host "Associated EIP $eip -> $instanceId" -ForegroundColor Green
}

if ($eip -eq $StagingIp) {
  Write-Host "NO-GO: EIP equals staging $StagingIp" -ForegroundColor Red
  exit 3
}

Write-Host "`n--- Provision result ---" -ForegroundColor Cyan
Write-Host "InstanceId: $instanceId"
Write-Host "EIP: $eip"
Write-Host "Region: $Region"
Write-Host "Name: $InstanceName"
exit 0