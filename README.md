# MMS 2.0 — Mining Method Selection Tool

## Overview
Web-based tool for underground mining method selection, implementing three classical selection algorithms simultaneously. Developed at LAPROM/UFRGS as part of a scientific initiation research project.

**Live:** https://art-f-py.github.io/mms-2.0/

---

## Selection Methods
| Method | Reference |
|--------|-----------|
| UBC 1995 | Miller, Pakalnis & Poulin |
| Nicholas 1981/1992 | Nicholas, D.E. |
| SH&B 2007 | Shahriar, Bakhtavar et al. |

Each method evaluates 10 candidate mining methods:
Open Pit · Block Caving · Sublevel Stoping · Sublevel Caving · Longwall · Room & Pillar · Shrinkage Stoping · Cut & Fill · Top Slicing · Square Set Stoping

---

## Features
- Unified input form — single parameter set runs all three methods simultaneously
- Real-time deposit cross-section visualization (SVG)
- Automatic RSS calculation from UCS, density and depth
- RMR input via direct class, GSI conversion or Q-System conversion
- Per-criterion weighting system with domain-level granularity
- Nicholas 1992 domain presets (geo / orebody / HW / FW multipliers)
- Interactive results with per-criterion radar breakdown
- Cross-validated against MMS 1.0 across multiple deposit scenarios

---

## Tech Stack
- React + Vite
- Recharts
- React Router
- GitHub Pages (deployment)

---

## Project Structure
src/
├── algorithms/        # Selection algorithms and weight tables
├── components/        # Reusable UI components
├── context/           # Global state (MmsContext)
├── data/              # Rock data (UCS, density)
├── pages/             # Home, Inputs, Statistics, DepositSketch
└── assets/            # Images

---

## Running Locally
```bash
npm install
npm run dev
```

## Deployment
```bash
npm run deploy
```

---

## References
- Bieniawski, Z. T. (1989). *Engineering Rock Mass Classifications*. John Wiley & Sons.
- Miller, T. L., Pakalnis, R., & Poulin, R. (1995). *UBC Mining Method Selection*. University of British Columbia.
- Nicholas, D. E. (1981). Method Selection — A Numerical Approach. In *Design and Operation of Caving and Sublevel Stoping Mines*. SME-AIME.
- Nicholas, D. E. (1992). Selection Procedure. In *Mining Engineering Handbook* (2nd ed., Vol. 2, pp. 2090–2106). SME.
- Shahriar, K. et al. (2007). A New Numerical Method and AHP for Mining Method Selection. *4th Int. Symp. on High Performance Mine Production*.

---

## Development
**Scientific Initiation — LAPROM/UFRGS**

| Role | Name |
|------|------|
| Development | Artur Feijó |
| Supervision | Higor Campos |
| Collaboration | Fernando Cardozo · Carlos Petter · Renato Petter |
