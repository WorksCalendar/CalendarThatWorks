# HIPAA / Security Notes (Planning Doc)

> This is a practical hardening checklist and not legal advice.

## Baseline controls

- Enforce authentication and authorization at your API boundary.
- Validate all event payloads server-side.
- Use HTTPS everywhere (including embedded form endpoints).
- Encrypt data at rest and in transit.
- Apply least-privilege roles for schedule editing.

## Calendar-specific concerns

- Avoid exposing PHI in feed URLs or query strings.
- Redact sensitive fields in client logs and analytics events.
- Restrict external form fields to minimum necessary data.
- Implement immutable audit trails for create/update/delete operations.

## Operational controls

- Rotate keys/tokens regularly.
- Configure data retention and deletion policies.
- Add incident response runbooks for data-access anomalies.
- Define backup/restore and disaster recovery procedures.

## Product usage guidance

WorksCalendar is UI infrastructure. HIPAA compliance depends on your full stack (identity, backend, storage, monitoring, policies, contracts).
