import { Building2, Globe, Shield, FileText } from "lucide-react"

export const templates = [
    {
        id: "federal-rfp",
        title: "Federal Government RFP",
        description: "Standard template for US Federal Government proposals, including FAR compliance sections and technical volume structure.",
        category: "Government",
        icon: Building2,
        color: "bg-blue-500",
        details: [
            "1. Executive Summary",
            "2. Technical Approach",
            "3. Management Plan",
            "4. Past Performance",
            "5. Pricing Volume",
            "6. Compliance Matrix (FAR/DFARS)"
        ]
    },
    {
        id: "enterprise-saas",
        title: "Enterprise SaaS Proposal",
        description: "Comprehensive outline for B2B SaaS solutions, focusing on security, scalability, and SLA requirements.",
        category: "Technology",
        icon: Globe,
        color: "bg-purple-500",
        details: [
            "1. Solution Overview",
            "2. Architecture & Scalability",
            "3. Security & Compliance (SOC2)",
            "4. Implementation Plan",
            "5. Service Level Agreement (SLA)",
            "6. Customer Success & Support"
        ]
    },
    {
        id: "cybersecurity-audit",
        title: "Cybersecurity Audit Response",
        description: "Structured response for security questionnaires and audit RFPs (SOC2, ISO 27001).",
        category: "Security",
        icon: Shield,
        color: "bg-green-500",
        details: [
            "1. Information Security Policy",
            "2. Access Control & Identity Management",
            "3. Data Encryption & Protection",
            "4. Incident Response Plan",
            "5. Business Continuity & DR",
            "6. Third-Party Risk Management"
        ]
    },
    {
        id: "state-local",
        title: "State & Local Government",
        description: "Tailored for state and municipal RFPs with focus on local compliance and community impact.",
        category: "Government",
        icon: Building2,
        color: "bg-orange-500",
        details: [
            "1. Cover Letter & Executive Summary",
            "2. Understanding of Requirements",
            "3. Proposed Solution & Methodology",
            "4. Project Team & Qualifications",
            "5. Local Impact & Community Benefits",
            "6. Cost Proposal"
        ]
    },
    {
        id: "healthcare-it",
        title: "Healthcare IT Services",
        description: "HIPAA-compliant proposal structure for healthcare providers and payers.",
        category: "Healthcare",
        icon: FileText,
        color: "bg-red-500",
        details: [
            "1. Executive Summary",
            "2. HIPAA Compliance & Security",
            "3. Clinical Workflow Integration",
            "4. Data Migration Strategy",
            "5. Training & Adoption Plan",
            "6. Support & Maintenance"
        ]
    },
    {
        id: "fintech-integration",
        title: "Fintech Integration",
        description: "Technical proposal for banking and financial services integration projects.",
        category: "Finance",
        icon: FileText,
        color: "bg-indigo-500",
        details: [
            "1. Integration Scope & Objectives",
            "2. API Specifications & Standards",
            "3. Security Architecture (PCI-DSS)",
            "4. Testing & QA Strategy",
            "5. Deployment & Rollout",
            "6. Regulatory Compliance"
        ]
    }
]

export const categories = ["All", "Government", "Technology", "Security", "Healthcare", "Finance"]
