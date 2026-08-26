{{- define "chart.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "chart.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "chart.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "chart.labels" -}}
helm.sh/chart: {{ include "chart.chart" . }}
{{ include "chart.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "chart.selectorLabels" -}}
app.kubernetes.io/name: {{ include "chart.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "chart.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "chart.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{- define "chart.dbServiceName" -}}
{{- printf "%s-db" .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end }}

{{/* Bundled database's data claim. Renaming it would strand existing volumes. */}}
{{- define "chart.dbDataClaimName" -}}
{{- if .Values.db.primary.persistence.existingClaim -}}
{{- .Values.db.primary.persistence.existingClaim -}}
{{- else -}}
{{- printf "%s-data" (include "chart.dbServiceName" .) -}}
{{- end -}}
{{- end }}

{{- define "chart.dbServiceHost" -}}
{{- printf "%s.%s.svc.cluster.local" (include "chart.dbServiceName" .) .Release.Namespace -}}
{{- end }}

{{/*
Name of the secret holding the bundled database's password: the operator's own
if they named one, otherwise the one this chart creates.
*/}}
{{- define "chart.dbSecretName" -}}
{{- .Values.db.auth.existingSecret | default (printf "%s-db" (include "chart.fullname" .)) -}}
{{- end }}

{{/*
DB connection env, emitted only when the in-cluster DB is enabled. The password
comes from a secret either way. For an external DB, provide DB_HOST/DB_USER/
DB_NAME via .Values.env and DB_PASSWORD via existingSecret.
*/}}
{{- define "chart.dbEnv" -}}
{{- if .Values.db.enabled }}
- name: DB_HOST
  value: {{ include "chart.dbServiceHost" . | quote }}
- name: DB_USER
  value: {{ .Values.db.auth.username | quote }}
- name: DB_PASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ include "chart.dbSecretName" . | quote }}
      key: {{ .Values.db.auth.passwordKey | quote }}
- name: DB_NAME
  value: {{ .Values.db.auth.database | quote }}
{{- end }}
{{- end }}

{{/*
The store's resource name. Mirrors the subchart's fullname logic: a plain
"<release>-rustfs" is wrong once the release name contains "rustfs", and the app
then points at a hostname that does not resolve.
*/}}
{{- define "chart.rustfsFullname" -}}
{{- $v := .Values.rustfs | default dict -}}
{{- if $v.fullnameOverride -}}
{{- $v.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := $v.nameOverride | default "rustfs" -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end }}

{{/* The subchart suffixes its Service with "-svc". */}}
{{- define "chart.rustfsServiceName" -}}
{{- printf "%s-svc" (include "chart.rustfsFullname" .) | trunc 63 | trimSuffix "-" -}}
{{- end }}

{{- define "chart.rustfsPort" -}}
{{- dig "service" "endpoint" "port" 9000 (.Values.rustfs | default dict) -}}
{{- end }}

{{/* In-cluster S3 endpoint: what the app, pipeline steps and seed job call. */}}
{{- define "chart.rustfsInternalEndpoint" -}}
{{- printf "http://%s.%s.svc.cluster.local:%v" (include "chart.rustfsServiceName" .) .Release.Namespace (include "chart.rustfsPort" .) -}}
{{- end }}

{{/*
Public S3 endpoint: presigned PUTs and STAC asset URLs. Empty without the S3
ingress - a service DNS name is no use to a browser.
*/}}
{{- define "chart.rustfsExternalEndpoint" -}}
{{- $ing := .Values.s3.rustfs.ingress -}}
{{- if $ing.enabled -}}
{{- $host := required "s3.rustfs.ingress.host is required when s3.rustfs.ingress.enabled=true" $ing.host -}}
{{- printf "%s://%s" (ternary "https" "http" $ing.tls.enabled) $host -}}
{{- end -}}
{{- end }}

{{/*
Origin serving the upload form: the bucket's default CORS allow-list. Without an
API ingress there is no cross-origin request to allow.
*/}}
{{- define "chart.appOrigin" -}}
{{- if .Values.ingress.enabled -}}
{{- printf "%s://%s" (ternary "https" "http" .Values.ingress.tls.enabled) (required "ingress.host is required when ingress.enabled=true" .Values.ingress.host) -}}
{{- end -}}
{{- end }}

{{/*
Effective app env. With the bundled store enabled the S3 settings are derived
from it, so the app, the pipeline steps (which take awsurl/externalaws from the
app) and the seed job cannot disagree. Anything set explicitly in `env` wins,
which is how you keep the bundled store but publish it under a CDN - except
S3_ENDPOINT, which deployment.yaml refuses alongside the bundled store rather
than let the bucket-init hook rewrite a bucket policy somewhere else.
*/}}
{{- define "chart.envMap" -}}
{{- $env := deepCopy .Values.env -}}
{{- if .Values.s3.rustfs.enabled -}}
{{- if not (get $env "S3_ENDPOINT") -}}
{{- $_ := set $env "S3_ENDPOINT" (include "chart.rustfsInternalEndpoint" .) -}}
{{- end -}}
{{- $external := include "chart.rustfsExternalEndpoint" . -}}
{{- if $external -}}
{{- if not (get $env "S3_EXTERNAL_ENDPOINT") -}}
{{- $_ := set $env "S3_EXTERNAL_ENDPOINT" $external -}}
{{- end -}}
{{- if not (get $env "PUBLIC_ASSET_BASE_URL") -}}
{{- $_ := set $env "PUBLIC_ASSET_BASE_URL" (printf "%s/%s" $external (get $env "S3_BUCKET")) -}}
{{- end -}}
{{- end -}}
{{- end -}}
{{- toYaml $env -}}
{{- end }}

{{/* Same map as env vars, for a pod spec. */}}
{{- define "chart.envVars" -}}
{{- range $key, $val := (include "chart.envMap" . | fromYaml) }}
- name: {{ $key }}
  value: {{ $val | quote }}
{{- end }}
{{- end }}

{{/*
rustfs.extraEnv repeats s3Secret's names, because Helm values cannot reference
each other. Left to drift, the store accepts credentials the app was never
given, and the only symptom is a runtime 403.
*/}}
{{- define "chart.validateRustfsCredentialMapping" -}}
{{- $want := dict
      "RUSTFS_ACCESS_KEY" .Values.s3Secret.accessKeyIdKey
      "RUSTFS_SECRET_KEY" .Values.s3Secret.secretAccessKeyKey -}}
{{- $extraEnv := dig "extraEnv" (list) (.Values.rustfs | default dict) -}}
{{- $mapped := 0 -}}
{{- range $name, $key := $want -}}
{{- range $entry := $extraEnv -}}
{{- if eq (dig "name" "" $entry) $name -}}
{{- $mapped = add1 $mapped -}}
{{- $ref := dig "valueFrom" "secretKeyRef" dict $entry -}}
{{- if or (ne (dig "name" "" $ref) $.Values.s3Secret.name) (ne (dig "key" "" $ref) $key) -}}
{{- fail (printf "rustfs.extraEnv %s reads secret %q key %q, but s3Secret gives the app %q key %q. Point them at the same credentials." $name (dig "name" "<none>" $ref) (dig "key" "<none>" $ref) $.Values.s3Secret.name $key) -}}
{{- end -}}
{{- end -}}
{{- end -}}
{{- end -}}
{{- if and (gt $mapped 0) (ne $mapped 2) -}}
{{- fail "rustfs.extraEnv maps only one of RUSTFS_ACCESS_KEY/RUSTFS_SECRET_KEY. Map both, or neither and put both in rustfs.secret.existingSecret." -}}
{{- end -}}
{{- end }}
