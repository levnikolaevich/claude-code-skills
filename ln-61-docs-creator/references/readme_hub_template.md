# {{PROJECT_NAME}} - Technical Documentation

**Version:** {{VERSION}}
**Last Updated:** {{DATE}}
**Status:** {{STATUS}}

<!-- SCOPE: Navigation hub for ALL project documentation. Links to requirements, architecture, technical specs, ADRs. NO content duplication - all details in linked documents. -->
<!-- DO NOT add here: Detailed requirements → requirements.md, Architecture details → architecture.md, Code examples → Task descriptions -->

---

## Overview

{{PROJECT_OVERVIEW}}

**Project Type:** {{PROJECT_TYPE}}

**Key Technologies:**
- Frontend: {{FRONTEND_TECH}}
- Backend: {{BACKEND_TECH}}
- Database: {{DATABASE_TECH}}

---

## Documentation Structure

This directory contains comprehensive technical documentation following industry standards (ISO/IEC/IEEE 29148, arc42, C4 Model).

### Core Documents

1. **[Requirements Specification](requirements.md)** - Functional and non-functional requirements
   - Functional Requirements (FR-XXX-NNN)
   - Non-Functional Requirements (NFR-CAT-NNN): Performance, Security, Scalability, Reliability, Maintainability, Usability, Compatibility
   - MoSCoW prioritization
   - Traceability matrix

2. **[Architecture Document](architecture.md)** - System architecture and design
   - Context and Scope (Business + Technical)
   - C4 Model diagrams (Context, Container, Component)
   - Runtime view (sequence diagrams)
   - Deployment architecture
   - Crosscutting concepts
   - ADR references

3. **[Technical Specification](technical_specification.md)** - Implementation details
   - Technology stack (specific versions)
   - Database schema (ER diagrams, data dictionary)
   - API specifications (endpoints, auth, error codes)
   - External integrations
   - Docker development environment
   - Security implementation
   - Performance optimization
   - Testing strategy

4. **[Architecture Decision Records (ADRs)](adrs/)** - Key technical decisions
   - [ADR Template](adrs/_template.md) - Template for new ADRs
   {{ADR_LIST}}

---

## Quick Links

### For Developers
- [Development Setup](technical_specification.md#11-development-environment-setup)
- [Technology Stack](technical_specification.md#21-technology-overview)
- [Database Schema](technical_specification.md#41-database-schema)
- [API Endpoints](technical_specification.md#52-api-endpoints)

### For Architects
- [C4 Container Diagram](architecture.md#52-level-2-container-diagram-c4-model)
- [C4 Component Diagram](architecture.md#53-level-3-component-diagram-c4-model)
- [Deployment Architecture](architecture.md#72-deployment-diagram)
- [All ADRs](adrs/)

### For Product Owners
- [Functional Requirements](requirements.md#3-functional-requirements)
- [Quality Goals](architecture.md#12-quality-goals)
- [Non-Functional Requirements](requirements.md#4-non-functional-requirements-nfr)

---

## Document Maintenance

All documents contain a **Maintenance** section with:
- **Update Triggers**: When to update the document
- **Verification**: How to verify document is current
- **Last Updated**: Date of last modification

Refer to individual document Maintenance sections for specific update criteria.

---

## Standards Compliance

This documentation follows:
- **ISO/IEC/IEEE 29148:2018**: Requirements Engineering
- **ISO/IEC/IEEE 42010:2022**: Architecture Description
- **arc42 Architecture Template**: Software architecture documentation
- **C4 Model**: Software architecture visualization
- **Michael Nygard's ADR Format**: Architecture Decision Records
- **MoSCoW Prioritization**: MUST/SHOULD/COULD/WON'T

---

## Related Documentation

- [Project Charter]({{PROJECT_CHARTER_LINK}}) - Business case and objectives
- [Definition of Done]({{DOD_LINK}}) - Quality criteria for deliverables
- [README.md](../README.md) - Project README with setup instructions

---

## Glossary

Quick reference to key terms:

| Term | Definition | Reference |
|------|------------|-----------|
| FR-XXX-NNN | Functional Requirement ID format | [Requirements](requirements.md#3-functional-requirements) |
| NFR-CAT-NNN | Non-Functional Requirement ID format | [Requirements](requirements.md#4-non-functional-requirements-nfr) |
| C4 Model | Context, Container, Component, Code diagrams | [Architecture](architecture.md#5-building-block-view) |
| ADR | Architecture Decision Record | [ADRs Directory](adrs/) |
| arc42 | Software architecture documentation template | [Architecture](architecture.md) |

---

## Contributing to Documentation

When updating documentation:
1. Check **SCOPE tags** at top of document to ensure changes belong there
2. Update **Maintenance > Last Updated** date
3. Add entry to **Revision History** table
4. Update this README.md if adding new documents
5. Run documentation verification (if available)

---

**Version:** 1.0.0
**Template Last Updated:** 2025-01-31
