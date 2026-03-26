/**
 * H-06: Parental Gate Strength Documentation Test
 *
 * Verifies the structural properties of the parental gate math challenge
 * in both ParentalGate.tsx (hook) and ParentDashboardScreen.tsx (inline).
 * Documents that the gate uses 2-digit addition, which is a known weakness
 * (solvable by a determined child) flagged for future strengthening.
 *
 * @finding H-06: Parental gate uses simple 2-digit addition
 * @status Verified — structural tests confirm gate properties
 */

import { readSourceFile, extractFunctionBlock } from './helpers';

describe('H-06: Parental gate strength', () => {
  let parentalGateSource: string;
  let parentDashboardSource: string;

  beforeAll(() => {
    parentalGateSource = readSourceFile(
      'src/components/common/ParentalGate.tsx',
    );
    parentDashboardSource = readSourceFile(
      'src/screens/ParentDashboardScreen.tsx',
    );
  });

  test('[H-06] ParentalGate generates 2-digit operands in 10–39 range', () => {
    // The generateProblem function should produce operands via:
    //   Math.floor(Math.random() * 30) + 10  →  range [10, 39]
    const generateBlock = extractFunctionBlock(
      parentalGateSource,
      'generateProblem',
    );
    expect(generateBlock).not.toBe('');

    // Verify the random range: * 30 and + 10 for both operands
    const rangePattern = /Math\.floor\(Math\.random\(\)\s*\*\s*30\)\s*\+\s*10/g;
    const matches = generateBlock.match(rangePattern);
    // Both `a` and `b` should use this formula
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(2);
  });

  test('[H-06] Incorrect answer regenerates a new problem', () => {
    // handleSubmit is a useCallback — extract the else-branch manually.
    // When the answer is wrong, generateProblem() is called to regenerate.
    // Pattern: `} else {` ... `generateProblem()` ... `setAnswer('')`
    const elseBranch = parentalGateSource.match(
      /\}\s*else\s*\{[\s\S]*?generateProblem\(\)[\s\S]*?\}/,
    );
    expect(elseBranch).not.toBeNull();

    // The else-branch should also clear the answer input
    expect(elseBranch![0]).toMatch(/setAnswer\(['"]{2}\)/);
  });

  test('[H-06] No skip/cancel-and-continue bypass exists', () => {
    // handleCancel is a useCallback — extract it by matching the pattern:
    //   const handleCancel = useCallback(() => { ... }, []);
    const cancelMatch = parentalGateSource.match(
      /const handleCancel\s*=\s*useCallback\(\(\)\s*=>\s*\{([\s\S]*?)\},\s*\[/,
    );
    expect(cancelMatch).not.toBeNull();
    const cancelBody = cancelMatch![1];

    // Cancel must NOT trigger the success path
    expect(cancelBody).not.toMatch(/openURL/);
    expect(cancelBody).not.toMatch(/Linking/);
    expect(cancelBody).not.toMatch(/onSuccess/);

    // Cancel should dismiss the modal and clear pending URL
    expect(cancelBody).toMatch(/visible:\s*false/);
    expect(cancelBody).toMatch(/pendingUrl:\s*null/);

    // The hook should only return { openURL, parentalGateModal } — no bypass function
    expect(parentalGateSource).toMatch(
      /return\s*\{\s*openURL,\s*parentalGateModal\s*\}/,
    );
  });

  test('[H-06] ParentDashboardScreen uses the same parental gate pattern', () => {
    // ParentDashboardScreen has an inline generateProblem with identical formula
    const dashboardGenerateBlock = extractFunctionBlock(
      parentDashboardSource,
      'generateProblem',
    );
    expect(dashboardGenerateBlock).not.toBe('');

    // Same 2-digit range formula
    const rangePattern = /Math\.floor\(Math\.random\(\)\s*\*\s*30\)\s*\+\s*10/g;
    const matches = dashboardGenerateBlock.match(rangePattern);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(2);

    // The gate screen's cancel calls navigation.goBack(), NOT onPass()
    expect(parentDashboardSource).toMatch(
      /onCancel.*navigation\.goBack|handleGateCancel.*navigation\.goBack/s,
    );
    // onPass only fires on correct answer
    expect(parentDashboardSource).toMatch(
      /parsed\s*===\s*problem\.a\s*\+\s*problem\.b[\s\S]*?onPass\(\)/,
    );
  });

  test('[H-06] Parental gate difficulty level documented — 2-digit addition only', () => {
    // This test documents the known weakness: the gate is 2-digit addition.
    // A stronger gate would use multiplication, multi-step problems, or
    // knowledge-based questions. This test passes to confirm the current state.

    // Verify it's addition (not multiplication or other operations)
    // The rendered problem text uses `{state.a} + {state.b}` or `{problem.a} + {problem.b}`
    expect(parentalGateSource).toMatch(/\{state\.a\}\s*\+\s*\{state\.b\}/);
    expect(parentDashboardSource).toMatch(
      /\{problem\.a\}\s*\+\s*\{problem\.b\}/,
    );

    // The answer check is `parsed === state.a + state.b` (simple addition)
    expect(parentalGateSource).toMatch(
      /parsed\s*===\s*state\.a\s*\+\s*state\.b/,
    );
    expect(parentDashboardSource).toMatch(
      /parsed\s*===\s*problem\.a\s*\+\s*problem\.b/,
    );

    // Document: max possible sum is 39 + 39 = 78, min is 10 + 10 = 20
    // This is solvable by children age 8+ and is flagged for strengthening
  });
});
