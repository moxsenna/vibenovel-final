$anon = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
$seedProject = "a0000000-0000-4000-8000-000000000101"
$results = New-Object System.Collections.Generic.List[object]

function Add-Result($name, $result, $detail) {
  $results.Add([PSCustomObject]@{ Test = $name; Result = $result; Detail = $detail }) | Out-Null
}

try {
  $h = Invoke-RestMethod "http://127.0.0.1:8787/health"
  Add-Result "GET /health" "PASS" "ok=$($h.ok)"
} catch {
  Add-Result "GET /health" "FAIL" $_.Exception.Message
}

try {
  Invoke-RestMethod "http://127.0.0.1:8787/api/me" | Out-Null
  Add-Result "GET /api/me no token" "FAIL" "expected 401"
} catch {
  Add-Result "GET /api/me no token" "PASS" $_.ErrorDetails.Message
}

$email = "s214-$(Get-Random)@example.com"
$pw = "TestPass123!"
$signup = Invoke-RestMethod -Uri "http://127.0.0.1:54321/auth/v1/signup" -Method POST -Headers @{ apikey = $anon; Authorization = "Bearer $anon" } -ContentType "application/json" -Body (@{ email = $email; password = $pw } | ConvertTo-Json)
$token = $signup.access_token
$auth = @{ Authorization = "Bearer $token" }
Add-Result "signup/login" $(if ($token) { "PASS" } else { "FAIL" }) $email

$p = Invoke-RestMethod "http://127.0.0.1:8787/api/projects" -Headers $auth
Add-Result "GET /api/projects" "PASS" "count=$($p.data.Count)"

$created = Invoke-RestMethod "http://127.0.0.1:8787/api/projects" -Method POST -Headers $auth -ContentType "application/json" -Body '{"title":"S214 Smoke","entryPath":"rough_idea"}'
$projectId = $created.data.id
Add-Result "POST /api/projects" "PASS" $projectId

$sg = Invoke-RestMethod "http://127.0.0.1:8787/api/projects/$projectId/settings" -Headers $auth
$put = Invoke-RestMethod "http://127.0.0.1:8787/api/projects/$projectId/settings" -Method PUT -Headers $auth -ContentType "application/json" -Body '{"qualityMode":"terbaik"}'
Add-Result "GET/PUT settings" "PASS" "put=$($put.data.qualityMode)"

$fg = Invoke-RestMethod "http://127.0.0.1:8787/api/projects/$projectId/foundation" -Headers $auth
$fput = Invoke-RestMethod "http://127.0.0.1:8787/api/projects/$projectId/foundation" -Method PUT -Headers $auth -ContentType "application/json" -Body '{"premise":"Smoke premise test","mainConflict":"Smoke conflict"}'
Add-Result "GET/PUT foundation" "PASS" "premise_len=$($fput.data.premise.Length)"

$ch = Invoke-RestMethod "http://127.0.0.1:8787/api/projects/$projectId/characters" -Method POST -Headers $auth -ContentType "application/json" -Body '{"name":"Smoke Char","roleLabel":"Tokoh Utama","description":"test","importance":"main","source":"user"}'
Add-Result "POST character" "PASS" $ch.data.id

$fact = Invoke-RestMethod "http://127.0.0.1:8787/api/projects/$projectId/facts" -Method POST -Headers $auth -ContentType "application/json" -Body '{"text":"Smoke fact","category":"identity","importance":"major","source":"user"}'
Add-Result "POST fact source=user" "PASS" $fact.data.id

try {
  Invoke-RestMethod "http://127.0.0.1:8787/api/projects/$projectId/facts" -Method POST -Headers $auth -ContentType "application/json" -Body '{"text":"AI fact","category":"identity","source":"ai_direct"}' | Out-Null
  Add-Result "POST fact ai_direct" "FAIL" "expected 400"
} catch {
  Add-Result "POST fact ai_direct" "PASS" $_.ErrorDetails.Message
}

$sr = Invoke-RestMethod "http://127.0.0.1:8787/api/projects/$projectId/speech-rules" -Method POST -Headers $auth -ContentType "application/json" -Body '{"relationshipLabel":"A ke B","ruleText":"Formal","source":"user"}'
Add-Result "POST speech rule user" "PASS" $sr.data.id

try {
  Invoke-RestMethod "http://127.0.0.1:8787/api/projects/$projectId/speech-rules" -Method POST -Headers $auth -ContentType "application/json" -Body '{"relationshipLabel":"X","ruleText":"Y","source":"ai_direct"}' | Out-Null
  Add-Result "POST speech rule ai_direct" "FAIL" "expected 400"
} catch {
  Add-Result "POST speech rule ai_direct" "PASS" $_.ErrorDetails.Message
}

$prop = Invoke-RestMethod "http://127.0.0.1:8787/api/projects/$projectId/proposals" -Method POST -Headers $auth -ContentType "application/json" -Body '{"proposalType":"fact","title":"Smoke proposal","summary":"High risk","payload":{"suggested_text":"secret"},"riskLevel":"high","source":"user_manual"}'
$propId = $prop.data.id
Add-Result "POST proposal high-risk" "PASS" "status=$($prop.data.status)"

$acc = Invoke-RestMethod "http://127.0.0.1:8787/api/projects/$projectId/proposals/$propId/accept" -Method POST -Headers $auth
Add-Result "accept proposal status-only" $(if ($acc.data.status -eq 'accepted') { "PASS" } else { "FAIL" }) $acc.data.status

$cr = Invoke-RestMethod "http://127.0.0.1:8787/api/credits/balance" -Headers $auth
Add-Result "GET credit balance" "PASS" "balance=$($cr.data.creditBalance)"

try {
  Invoke-RestMethod "http://127.0.0.1:8787/api/projects/$seedProject" -Headers $auth | Out-Null
  Add-Result "cross-user project 404" "FAIL" "expected 404"
} catch {
  Add-Result "cross-user project 404" "PASS" $_.ErrorDetails.Message
}

$results | Format-Table -AutoSize
$fail = $results | Where-Object { $_.Result -eq 'FAIL' }
if ($fail.Count -gt 0) { exit 1 }