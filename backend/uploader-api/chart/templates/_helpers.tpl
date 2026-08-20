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
