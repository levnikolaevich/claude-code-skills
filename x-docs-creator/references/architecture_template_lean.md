# Software Architecture Document: {{PROJECT_NAME}}

**Document Version:** 1.0
**Date:** {{DATE}}
**Status:** {{STATUS}}
**Architecture Framework:** arc42 (simplified)
**Standard Compliance:** ISO/IEC/IEEE 42010:2022

<!-- SCOPE: System architecture (arc42 structure), C4 diagrams (Context, Container, Component), runtime scenarios (sequence diagrams), deployment architecture, crosscutting concepts, ADR references ONLY. -->
<!-- DO NOT add here: Technology stack versions → Technical_Specification.md, Detailed API specs → Technical_Specification.md, Requirements → Requirements.md, Code examples → Task descriptions -->

---

## 1. Introduction and Goals

### 1.1 Requirements Overview
{{REQUIREMENTS_OVERVIEW}}

### 1.2 Quality Goals
{{QUALITY_GOALS}}

### 1.3 Stakeholders
{{STAKEHOLDERS_SUMMARY}}

---

## 2. Constraints

### 2.1 Technical Constraints
{{TECHNICAL_CONSTRAINTS}}

### 2.2 Organizational Constraints
{{ORGANIZATIONAL_CONSTRAINTS}}

### 2.3 Conventions
{{CONVENTIONS}}

---

## 3. Context and Scope

### 3.1 Business Context
{{BUSINESS_CONTEXT}}

**Business Context Diagram:**
```mermaid
{{BUSINESS_CONTEXT_DIAGRAM}}
```

**External Interfaces:**
{{EXTERNAL_INTERFACES}}

### 3.2 Technical Context
{{TECHNICAL_CONTEXT}}

**Technical Context Diagram:**
```mermaid
{{TECHNICAL_CONTEXT_DIAGRAM}}
```

---

## 4. Solution Strategy

### 4.1 Technology Decisions
{{TECHNOLOGY_DECISIONS}}

### 4.2 Top-Level Decomposition
{{TOP_LEVEL_DECOMPOSITION}}

### 4.3 Approach to Quality Goals
{{QUALITY_APPROACH}}

---

## 5. Building Block View

### 5.1 Level 1: System Context (C4 Model)
{{SYSTEM_CONTEXT}}

**System Context Diagram:**
```mermaid
{{SYSTEM_CONTEXT_DIAGRAM}}
```

### 5.2 Level 2: Container Diagram (C4 Model)
{{CONTAINER_DIAGRAM}}

**Container Diagram:**
```mermaid
{{CONTAINER_DIAGRAM_MERMAID}}
```

### 5.3 Level 3: Component Diagram (C4 Model)
{{COMPONENT_DIAGRAM}}

**API Application Components:**
```mermaid
{{COMPONENT_DIAGRAM_MERMAID}}
```

**Key Components:**
{{KEY_COMPONENTS}}

---

## 6. Runtime View

### 6.1 Scenario 1: User Registration
{{SCENARIO_USER_REGISTRATION}}

**Sequence Diagram:**
```mermaid
{{SCENARIO_1_SEQUENCE_DIAGRAM}}
```

### 6.2 Scenario 2: Product Purchase Flow
{{SCENARIO_PURCHASE_FLOW}}

**Sequence Diagram:**
```mermaid
{{SCENARIO_2_SEQUENCE_DIAGRAM}}
```

### 6.3 [Additional Key Scenarios]
{{ADDITIONAL_SCENARIOS}}

---

## 7. Deployment View

### 7.1 Infrastructure Overview
{{INFRASTRUCTURE_OVERVIEW}}

### 7.2 Deployment Diagram
{{DEPLOYMENT_DIAGRAM}}

**Deployment Architecture:**
```mermaid
{{DEPLOYMENT_DIAGRAM_MERMAID}}
```

### 7.3 Deployment Mapping
{{DEPLOYMENT_MAPPING}}

---

## 8. Crosscutting Concepts

### 8.1 Security Concept
{{SECURITY_CONCEPT}}

### 8.2 Error Handling Concept
{{ERROR_HANDLING_CONCEPT}}

### 8.3 Logging and Monitoring Concept
{{LOGGING_MONITORING_CONCEPT}}

### 8.4 Testing Concept
{{TESTING_CONCEPT}}

### 8.5 Configuration Management Concept
{{CONFIG_MANAGEMENT_CONCEPT}}

---

## 9. Architecture Decisions (ADRs)

{{ADR_LIST}}

**Critical ADRs Summary:**
{{CRITICAL_ADRS_SUMMARY}}

---

## 10. Quality Scenarios

{{QUALITY_SCENARIOS}}

---

## 11. Risks and Technical Debt

### 11.1 Known Technical Risks
{{TECHNICAL_RISKS}}

### 11.2 Technical Debt
{{TECHNICAL_DEBT}}

### 11.3 Mitigation Strategies
{{MITIGATION_STRATEGIES}}

---

## 12. Glossary

| Term | Definition |
|------|------------|
| {{TERM_1}} | {{DEFINITION_1}} |
| Container | Deployable/runnable unit (C4 Model), NOT Docker container |
| Component | Grouping of related functionality within a container |
| SSR | Server-Side Rendering |
| RBAC | Role-Based Access Control |
| JWT | JSON Web Token |

---

## 13. References

1. arc42 Architecture Template - https://arc42.org/
2. C4 Model for Visualizing Software Architecture - https://c4model.com/
3. ISO/IEC/IEEE 42010:2022 - Architecture description
4. {{PROJECT_NAME}} Requirements Document
5. {{PROJECT_NAME}} ADRs Directory

---

## Maintenance

**Last Updated:** {{DATE}}

**Update Triggers:**
- New architectural decisions (create new ADR, update Section 9)
- New microservices or containers added (update C4 Container diagram)
- New components in existing services (update C4 Component diagram)
- Changes to deployment topology (update Deployment diagram)
- New external systems or integrations (update Context diagram)
- Major refactoring affecting system structure

**Verification:**
- All C4 diagrams (Context, Container, Component) are consistent
- All ADRs referenced in Section 9 exist in adrs/ directory
- Deployment diagram matches actual infrastructure
- Runtime view scenarios cover main use cases
- All external systems documented in Technical Context

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | {{DATE}} | {{AUTHOR}} | Initial version |

---

**Version:** 1.0.0
**Template Last Updated:** 2025-01-30
