# Manual rollout

Use when the user requests deployment through direct server access or an existing provider CLI/API without the normal pipeline. Consume the main skill's authorization, evidence and recovery contracts. Do not introduce CI, publish a repository or trigger paid jobs merely to deploy manually.

## Build and transfer

- Bind local checks and the artifact to one source revision. Export that revision to an isolated build context when the checkout contains unrelated changes; a successful build of a dirty checkout does not prove committed provenance.
- Inspect the build definition and CI for version arguments and defaults. When building manually, supply the intended source-derived application version and revision metadata through the existing build mechanism; verify their values in the resulting artifact. If no reliable mapping is available, record the gap instead of treating a default or date-like string as proof of the revision.
- Choose the build location using actual CPU, memory, disk, architecture and build tooling. Prefer local or existing build-host packaging when a production build would compete with the running service. Reuse the project's build definition and compatible target platform.
- For container delivery without a registry, save and transfer the image through authenticated SSH/SFTP or an equivalent approved channel. Verify the archive checksum and loaded artifact identity before replacement. Account for platform-specific image config digests versus multi-platform index digests; compare the same identity, not merely a mutable tag. Preserve a revision label or equivalent build metadata.
- Inspect permissions and free space before transfer. Use a private writable staging directory. Keep secrets out of arguments, logs and source archives; configuration backups containing secrets need restricted access. Remove only run-owned staging files after verification.

## Switch and recover

- Record the running artifact, deployment configuration and automatic updater state. Preserve a usable rollback artifact and configuration before replacing either. Data migration compatibility follows the project's existing policy; a container rollback does not undo database changes.
- Prevent automatic reconcilers or image updaters from replacing the manual release with a stale remote artifact. Use the platform's supported pause, pin or exclusion mechanism, scoped to affected services. A running updater is safe only when its effective configuration cannot undo the manual release.
- Change only the intended artifact references and necessary updater settings. Preserve runtime secrets, mounts, networks, resource limits and logging. Validate the effective configuration without printing sensitive values.
- Roll out coupled API, worker and scheduler processes according to their migration and compatibility contract. Pin them to the intended immutable artifact. Avoid an implicit pull of a mutable remote tag during recreation.
- If health fails, stop forward rollout and use the preserved artifact through the evidenced recovery path. Keep updater protection active during rollback; restoring an old configuration that references `latest` can otherwise replace the rollback again. Verify the recovered service, not just the rollback command.

## Prove the outcome

- Verify actual running artifact identity, applicable readiness checks, relevant startup errors and required smoke behavior. Check the exposed application version when available, using the main skill's identity-proof rule. Observe restarts and updater behavior for the project's required window. A successful upload or container start alone does not prove a healthy deployment; report completed external mutations separately from unverified health.
- Reconcile the project runbook with the effective manual mode and record how a later authorized release resumes the pipeline or updater safely. Do not re-enable an updater until its target artifact is verified as compatible with the intended release.
- Report deployment separately from commit, push, registry publication and local packaging. Keep provider addresses, service names, concrete commands and credentials in their project-owned sources, not this general skill.
