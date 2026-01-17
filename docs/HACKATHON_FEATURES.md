# GrantMatch - Hackathon Feature Ideas

## Problem Statement

> How might non-profit organisations "pull" information about grants from OurSG grants portal that are relevant to them according to key criteria including issue area, scope of grant, KPIs, funding quantum, application due date, etc. so that they can strengthen their financial sustainability?

---

## Winning Feature Framework

Based on analysis of previous hackathon winners, strong projects combine:

| Element | Description |
|---------|-------------|
| **Gamification** | Rewards, badges, progress tracking |
| **Automation** | Reduce manual work, smart insights |
| **Bridge Digital/Physical** | Connect web app to real-world actions |
| **Personalization** | User-centric customization |

---

## Proposed Features

### 1. 🎯 Grant Application Tracker

**High Impact - Gamification + Automation**

- Track grant applications through stages: Draft → Submitted → Under Review → Awarded/Rejected
- Display success rate analytics: "You've applied to 5 grants, won 2 (40% success rate)"
- Gamify with badges:
  - "First Application" 
  - "Grant Master" (5 successful applications)
  - "Streak Seeker" (applied 3 months in a row)

### 2. 🏢 Organization Profile Builder

**Personalization + Smart Matching**

- NPOs input their:
  - Mission statement
  - Past projects & outcomes
  - KPIs they can deliver
  - Preferred funding range
  - Geographic scope
- Auto-match grants based on profile (not just search)
- "Profile Completeness Score" (like LinkedIn's profile strength)

### 3. 📅 Smart Deadline Calendar

**Automation + Bridge to Real World**

- Auto-add saved grant deadlines to calendar (Google/Outlook integration)
- Email reminders:
  - 1 week before deadline
  - 3 days before deadline
  - 1 day before deadline
- Dashboard widget: "Upcoming Deadlines This Week"

### 4. ⚖️ Grant Comparison View

**Strong UX**

- Select 2-3 grants to compare side-by-side
- Compare:
  - Funding amount
  - Application deadline
  - Required KPIs
  - Scope (local/national)
  - Eligibility criteria
- Help orgs prioritize which grants to apply for

### 5. 👥 Collaborative Workspace

**Unique Differentiator**

- Multiple team members can work on same grant application
- Features:
  - Comments on specific grant opportunities
  - Task assignments for application prep
  - Document sharing for proposals
- Example: "Assigned to: Sarah - Draft proposal due Friday"

---

## Implementation Priority

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| 1 | Organization Profile Builder | Medium | High |
| 2 | Grant Application Tracker | Medium | High |
| 3 | Deadline Calendar Widget | Low | Medium |
| 4 | Grant Comparison View | Low | Medium |
| 5 | Collaborative Workspace | High | High |

---

## Technical Notes

- **Profile Builder**: Store in Supabase `user_profiles` table, use for matching
- **Application Tracker**: New table `grant_applications` with status enum
- **Calendar**: Use Google Calendar API or ICS file export
- **Comparison**: Frontend-only feature, no backend changes
- **Collaboration**: Would need real-time sync (Supabase Realtime)

---

## Current Features Already Implemented

- ✅ NLP-powered grant search (Groq/Gemini)
- ✅ Manual filter system
- ✅ Email alerts for matching grants
- ✅ Save/bookmark grants
- ✅ Match scoring algorithm