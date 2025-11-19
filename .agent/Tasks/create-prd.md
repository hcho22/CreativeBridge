# Rule: Generating a Product Requirements Document (PRD)

## Goal
To guide an AI assistant in creating a detailed Product Requirement Document (PRD) in Markdown format, based on an initial user prompt. The PRD should be clear, actionable, and suitable for a junior developer to understand and implement the feature.

## Process

1. **Receive Initial Prompt:** The user provides a brief description or request for a new feature or functionality.
2. **Ask Clarifying Questions:** Before writing the PRD, the AI _must_ ask clarifying questions to gather sufficient detail. The goal is to understand the "why" and "what" of the feature, not necessarily the "how" (which the developer will figure out).
3. **Generate PRD** Based on the initial prompt and the user's answers to the clarifying questions, generate a PRD using the structure outlined below.
4. **Save PRD** Save the generated document as '[feature-name]-PRD.md' inside the '/.agent/Tasks' directory.
