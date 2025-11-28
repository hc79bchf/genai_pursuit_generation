---
marp: true
theme: gaia
class: lead
backgroundColor: #fff
style: |
  section {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 24px;
  }
  h1 {
    color: #0288d1;
  }
---

<!-- _class: invert -->
![bg right:40%](https://images.unsplash.com/photo-1518770660439-4636190af475?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80)

# Proposal for TechCorp
## AI Platform Modernization

**Submitted by:** Pursuit Team
**Date:** November 28, 2025

---

# Executive Summary

- **Objective:** Build a scalable, secure AI Platform.
- **Key Benefits:**
    - Auto-scaling infrastructure
    - SOC2 Compliance
    - Faster Time-to-Market
- **Our Commitment:** Deep expertise in Cloud & AI.

<!-- note: Keep it punchy. -->

---

<!-- _backgroundColor: #f0f8ff -->

# Proposed Solution: Architecture

<div class="mermaid">
graph TD;
    A[Data Sources] --> B[Data Lake S3];
    B --> C[Feature Store];
    C --> D[Training Cluster EKS];
    D --> E[Model Registry];
    E --> F[Inference API];
</div>

- **Scalable:** EKS based.
- **Secure:** IAM & VPC integration.

---

# Methodology

![bg left:30%](https://images.unsplash.com/photo-1531403009284-440f080d1e12?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80)

1. **Discovery:** Requirements gathering.
2. **Design:** Architecture blueprint.
3. **Build:** Infrastructure as Code.
4. **Migrate:** Move existing models.
5. **Train:** Handover to team.

---

# Conclusion

We are ready to start.

**Next Steps:**
- Sign Contract
- Kickoff Meeting

---

# Understanding Your Requirements

We understand that TechCorp requires:
1.  **High Availability:** 99.99% uptime for critical AI services.
2.  **Security Compliance:** Adherence to SOC2 and ISO27001 standards.
3.  **Scalability:** Ability to handle petabytes of data and thousands of concurrent model training jobs.

*Our solution is designed specifically to address these core needs.*

---

# Proposed Solution: Architecture

- **Core Infrastructure:** AWS EKS for container orchestration.
- **Data Layer:** S3 for data lake, Feature Store for ML features.
- **ML Ops:** Kubeflow pipelines for end-to-end model lifecycle management.
- **Security:** IAM roles, VPC endpoints, and encryption at rest/transit.

![bg right:40%](https://via.placeholder.com/300x200?text=Architecture+Diagram)

---

# Methodology & Timeline

## Phase 1: Discovery & Design (Weeks 1-4)
- Stakeholder interviews
- Architecture blueprinting

## Phase 2: Implementation (Weeks 5-12)
- Infrastructure provisioning (Terraform)
- Pipeline setup

## Phase 3: Migration & Training (Weeks 13-16)
- Model migration
- Team training and handover

---

# Our Team

- **John Doe (Principal Architect):** 15+ years in Cloud & AI.
- **Jane Smith (ML Ops Lead):** Expert in Kubeflow and TensorFlow.
- **Bob Johnson (Security Specialist):** Certified AWS Security Specialty.

---

# Conclusion

We are excited to partner with TechCorp on this transformative journey. Our proposed solution offers the perfect blend of innovation, security, and reliability.

**Next Steps:**
- Finalize contract
- Kick-off meeting next week

