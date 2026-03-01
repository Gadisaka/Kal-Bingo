export type BingoColumn = "B" | "I" | "N" | "G" | "O";

export type BingoCard = {
  id: number;
} & Record<BingoColumn, number[]>;

export type BingoPattern =
  | "1line"
  | "2line"
  | "3line"
  | "Large4Corner"
  | "Small4Corner"
  | "L"
  | "X"
  | "T"
  | "AnyLineOrLarge4Corner"
  | "AnyLineOrSmall4Corner"
  | "diagonals"
  | "x"
  | "outerSquare"
  | "innerSquare";

export type CardSetId = "set1" | "set2" | "set3" | "set4" | "set5" | "set6";

export interface WinningResult {
  isWinner: boolean;
  winningCells: Array<{ row: number; col: number }>;
  status: "win" | "lose" | "not_now";
}

export function checkWinningPattern(
  card: BingoCard,
  calledNumbers: (number | string)[],
  pattern: BingoPattern = "1line",
  currentNumber?: number | string
): WinningResult {
  const columns = ["B", "I", "N", "G", "O"] as const;
  const size = 5;
  // We'll build winningCells based on the specific pattern that wins

  // Helper function to check if a number is called
  const isCalled = (num: number | string) => calledNumbers.includes(num);

  // Helper function to get number at position
  const getNumberAt = (row: number, col: number) => {
    const column = columns[col];
    return card[column][row];
  };

  // Helper function to check if a cell is marked (called or free space)
  const isMarked = (row: number, col: number): boolean => {
    if (row === 2 && col === 2) return true; // Always free
    const num = getNumberAt(row, col);
    if (num === 0 || num === null || String(num) === "FREE") return true; // Handle all edge cases
    return isCalled(num);
  };

  // Check rows
  const winningRows: Array<{ row: number; col: number }>[] = [];
  for (let row = 0; row < size; row++) {
    let rowWin = true;
    const rowCells: Array<{ row: number; col: number }> = [];

    for (let col = 0; col < size; col++) {
      if (!isMarked(row, col)) {
        rowWin = false;
        break;
      }
      rowCells.push({ row, col });
    }

    if (rowWin) {
      winningRows.push(rowCells);
    }
  }

  // Check columns
  const winningColumns: Array<{ row: number; col: number }>[] = [];
  for (let col = 0; col < size; col++) {
    let colWin = true;
    const colCells: Array<{ row: number; col: number }> = [];

    for (let row = 0; row < size; row++) {
      if (!isMarked(row, col)) {
        colWin = false;
        break;
      }
      colCells.push({ row, col });
    }

    if (colWin) {
      winningColumns.push(colCells);
      // winningCells will be built based on the winning pattern
    }
  }

  // Check diagonals
  const winningDiagonals: Array<{ row: number; col: number }>[] = [];

  // Diagonal 1: Top-left to bottom-right
  let diag1Win = true;
  const diag1Cells: Array<{ row: number; col: number }> = [];
  for (let i = 0; i < size; i++) {
    if (!isMarked(i, i)) {
      diag1Win = false;
      break;
    }
    diag1Cells.push({ row: i, col: i });
  }
  if (diag1Win) {
    winningDiagonals.push(diag1Cells);
    // winningCells will be built based on the winning pattern
  }

  // Diagonal 2: Top-right to bottom-left
  let diag2Win = true;
  const diag2Cells: Array<{ row: number; col: number }> = [];
  for (let i = 0; i < size; i++) {
    if (!isMarked(i, size - 1 - i)) {
      diag2Win = false;
      break;
    }
    diag2Cells.push({ row: i, col: size - 1 - i });
  }
  if (diag2Win) {
    winningDiagonals.push(diag2Cells);
    // winningCells will be built based on the winning pattern
  }

  // Check X pattern (both diagonals)
  const xPatternCells: Array<{ row: number; col: number }> = [];
  if (diag1Win && diag2Win) {
    xPatternCells.push(...diag1Cells, ...diag2Cells);
  }

  // Check outer square pattern (4 corners only)
  const outerSquareCells: Array<{ row: number; col: number }> = [];
  let outerSquareWin = true;

  // Check only the 4 corner cells
  const corners = [
    { row: 0, col: 0 }, // Top-left
    { row: 0, col: 4 }, // Top-right
    { row: 4, col: 0 }, // Bottom-left
    { row: 4, col: 4 }, // Bottom-right
  ];

  for (const corner of corners) {
    if (!isMarked(corner.row, corner.col)) {
      outerSquareWin = false;
      break;
    }
    outerSquareCells.push(corner);
  }

  // Check inner square pattern (4 corners of 3x3 center area only)
  const innerSquareCells: Array<{ row: number; col: number }> = [];
  let innerSquareWin = true;

  // Check only the 4 corner cells of the 3x3 center area
  const innerCorners = [
    { row: 1, col: 1 }, // Top-left of inner area
    { row: 1, col: 3 }, // Top-right of inner area
    { row: 3, col: 1 }, // Bottom-left of inner area
    { row: 3, col: 3 }, // Bottom-right of inner area
  ];

  for (const corner of innerCorners) {
    if (!isMarked(corner.row, corner.col)) {
      innerSquareWin = false;
      break;
    }
    innerSquareCells.push(corner);
  }

  // Count total winning lines for multiple line patterns
  const totalWinningLines =
    winningRows.length + winningColumns.length + winningDiagonals.length;

  // Helper function to check if current number is part of winning pattern
  const checkCurrentNumberInPattern = (
    winningCells: Array<{ row: number; col: number }>
  ): "win" | "not_now" => {
    if (!currentNumber) return "win"; // No current number to check

    const hasCurrentNumberInPattern = winningCells.some(({ row, col }) => {
      const num = card[columns[col]][row];
      return num === currentNumber;
    });

    // Debug logging for "not_now" cases
    if (!hasCurrentNumberInPattern) {
      console.log(
        `🔍 "not_now" detected: currentNumber=${currentNumber}, winningCells=${winningCells.length} cells`
      );
      console.log(`🔍 Winning cells:`, winningCells);
      console.log(
        `🔍 Card numbers at winning positions:`,
        winningCells.map(({ row, col }) => {
          const num = card[columns[col]][row];
          return `${row},${col}:${num}`;
        })
      );
    }

    return hasCurrentNumberInPattern ? "win" : "not_now";
  };

  // Check specific patterns
  switch (pattern) {
    case "1line": {
      // Check if any of the 6 specific patterns are completed
      let completedPatterns = 0;
      let winningCells: Array<{ row: number; col: number }> = [];

      // Collect ALL winning cells from ALL completed patterns
      if (winningRows.length >= 1) {
        completedPatterns++;
        winningCells.push(...winningRows.flat()); // Add ALL winning rows
      }
      if (winningColumns.length >= 1) {
        completedPatterns++;
        winningCells.push(...winningColumns.flat()); // Add ALL winning columns
      }
      if (winningDiagonals.length >= 1) {
        completedPatterns++;
        winningCells.push(...winningDiagonals.flat()); // Add ALL winning diagonals
      }
      if (innerSquareWin) {
        completedPatterns++;
        winningCells.push(...innerSquareCells); // Add inner square
      }
      if (outerSquareWin) {
        completedPatterns++;
        winningCells.push(...outerSquareCells); // Add outer square
      }
      if (diag1Win && diag2Win) {
        completedPatterns++;
        winningCells.push(...xPatternCells); // Add X pattern
      }

      // Remove duplicates (in case patterns overlap)
      const uniqueWinningCells = winningCells.filter(
        (cell, index, self) =>
          index ===
          self.findIndex((c) => c.row === cell.row && c.col === cell.col)
      );

      const isWinner = completedPatterns >= 1;
      const status = isWinner
        ? checkCurrentNumberInPattern(uniqueWinningCells)
        : "lose";
      return { isWinner, winningCells: uniqueWinningCells, status };
    }
    case "2line": {
      // Check 2 or more patterns from the specific set
      let completedPatterns = 0;
      let patternCells: Array<Array<{ row: number; col: number }>> = [];

      // Collect winning patterns and their cells separately
      // Fix: increment by actual number of completed patterns
      completedPatterns += winningRows.length;
      patternCells.push(...winningRows);

      completedPatterns += winningColumns.length;
      patternCells.push(...winningColumns);

      completedPatterns += winningDiagonals.length;
      patternCells.push(...winningDiagonals);

      if (innerSquareWin) {
        completedPatterns++;
        patternCells.push(innerSquareCells);
      }
      if (outerSquareWin) {
        completedPatterns++;
        patternCells.push(outerSquareCells);
      }
      if (diag1Win && diag2Win) {
        completedPatterns++;
        patternCells.push(xPatternCells);
      }

      const isWinner = completedPatterns >= 2;

      if (isWinner) {
        // Fix: Use the same approach as 1line
        // Collect all completed line cells
        const winningCells = patternCells.flat();

        // Deduplicate them using Map for efficiency
        const uniqueWinningCells = [
          ...new Map(
            winningCells.map((cell) => [`${cell.row}-${cell.col}`, cell])
          ).values(),
        ];

        const status = checkCurrentNumberInPattern(uniqueWinningCells);
        return { isWinner, winningCells: uniqueWinningCells, status };
      } else {
        return { isWinner: false, winningCells: [], status: "lose" };
      }
    }
    case "3line": {
      // Check 3 or more patterns from the specific set
      let completedPatterns = 0;
      let patternCells: Array<Array<{ row: number; col: number }>> = [];

      // Collect winning patterns and their cells separately
      // Fix: increment by actual number of completed patterns
      completedPatterns += winningRows.length;
      patternCells.push(...winningRows);

      completedPatterns += winningColumns.length;
      patternCells.push(...winningColumns);

      completedPatterns += winningDiagonals.length;
      patternCells.push(...winningDiagonals);

      if (innerSquareWin) {
        completedPatterns++;
        patternCells.push(innerSquareCells);
      }
      if (outerSquareWin) {
        completedPatterns++;
        patternCells.push(outerSquareCells);
      }
      if (diag1Win && diag2Win) {
        completedPatterns++;
        patternCells.push(xPatternCells);
      }

      const isWinner = completedPatterns >= 3;

      if (isWinner) {
        // Fix: Use the same approach as 1line
        // Collect all completed line cells
        const winningCells = patternCells.flat();

        // Deduplicate them using Map for efficiency
        const uniqueWinningCells = [
          ...new Map(
            winningCells.map((cell) => [`${cell.row}-${cell.col}`, cell])
          ).values(),
        ];

        const status = checkCurrentNumberInPattern(uniqueWinningCells);
        return { isWinner, winningCells: uniqueWinningCells, status };
      } else {
        return { isWinner: false, winningCells: [], status: "lose" };
      }
    }
    case "diagonals": {
      const isWinner = winningDiagonals.length >= 1;
      const winningCells = winningDiagonals.flat();
      const status = isWinner
        ? checkCurrentNumberInPattern(winningCells)
        : "lose";
      return { isWinner, winningCells, status };
    }
    case "x": {
      const isWinner = diag1Win && diag2Win;
      const status = isWinner
        ? checkCurrentNumberInPattern(xPatternCells)
        : "lose";
      return { isWinner, winningCells: xPatternCells, status };
    }
    case "outerSquare": {
      const status = outerSquareWin
        ? checkCurrentNumberInPattern(outerSquareCells)
        : "lose";
      return {
        isWinner: outerSquareWin,
        winningCells: outerSquareCells,
        status,
      };
    }
    case "innerSquare": {
      const status = innerSquareWin
        ? checkCurrentNumberInPattern(innerSquareCells)
        : "lose";
      return {
        isWinner: innerSquareWin,
        winningCells: innerSquareCells,
        status,
      };
    }
    default: {
      // For default case, build winningCells from all winning patterns
      let winningCells: Array<{ row: number; col: number }> = [];
      if (winningRows.length >= 1) {
        winningCells.push(...winningRows.flat());
      }
      if (winningColumns.length >= 1) {
        winningCells.push(...winningColumns.flat());
      }
      if (winningDiagonals.length >= 1) {
        winningCells.push(...winningDiagonals.flat());
      }
      // Remove duplicates (in case patterns overlap)
      const uniqueWinningCells = winningCells.filter(
        (cell, index, self) =>
          index ===
          self.findIndex((c) => c.row === cell.row && c.col === cell.col)
      );

      const isWinner = totalWinningLines >= 1;
      const status = isWinner
        ? checkCurrentNumberInPattern(uniqueWinningCells)
        : "lose";
      return { isWinner, winningCells: uniqueWinningCells, status };
    }
  }
}

// Test function to verify all patterns work correctly
export function testAllPatterns() {
  console.log("🧪 Testing Bingo Pattern Recognition...\n");

  // Test bingo card
  const testCard: BingoCard = {
    id: 1,
    B: [1, 2, 3, 4, 5],
    I: [16, 17, 18, 19, 20],
    N: [31, 32, "FREE" as any, 34, 35], // Free space at center (row 2, col 2)
    G: [46, 47, 48, 49, 50],
    O: [61, 62, 63, 64, 65],
  };

  // Test 1: Single line pattern
  console.log("1️⃣ Testing 1line pattern:");
  const calledNumbers1 = [1, 16, 31, 46, 61]; // Top row (horizontal: B[0], I[0], N[0], G[0], O[0])
  const result1 = checkWinningPattern(testCard, calledNumbers1, "1line", 61); // 61 is the current number
  console.log(
    `   Top row (horizontal) called: ${
      result1.isWinner ? "✅ PASS" : "❌ FAIL"
    }`
  );
  console.log(`   Status: ${result1.status}`);
  console.log(`   Winning cells: ${result1.winningCells.length}`);

  // Test 2: Two line pattern
  console.log("\n2️⃣ Testing 2line pattern:");
  const calledNumbers2 = [1, 16, 31, 46, 61, 2, 17, 32, 47, 62]; // Top two rows (horizontal: row 0 + row 1)
  const result2 = checkWinningPattern(testCard, calledNumbers2, "2line", 62); // 62 is the current number
  console.log(
    `   Two rows (horizontal) called: ${
      result2.isWinner ? "✅ PASS" : "❌ FAIL"
    }`
  );
  console.log(`   Status: ${result2.status}`);
  console.log(`   Winning cells: ${result2.winningCells.length}`);

  // Test 3: Diagonal pattern
  console.log("\n3️⃣ Testing diagonal pattern:");
  const calledNumbers3 = [1, 17, "FREE", 49, 65]; // Main diagonal
  const result3 = checkWinningPattern(
    testCard,
    calledNumbers3,
    "diagonals",
    65
  ); // 65 is the current number
  console.log(`   Main diagonal: ${result3.isWinner ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`   Status: ${result3.status}`);
  console.log(`   Winning cells: ${result3.winningCells.length}`);

  // Test 4: X pattern
  console.log("\n4️⃣ Testing X pattern:");
  const calledNumbers4 = [1, 17, "FREE", 49, 65, 5, 19, "FREE", 47, 61]; // Both diagonals
  const result4 = checkWinningPattern(testCard, calledNumbers4, "x", 61); // 61 is the current number
  console.log(`   X pattern: ${result4.isWinner ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`   Status: ${result4.status}`);
  console.log(`   Winning cells: ${result4.winningCells.length}`);

  // Test 5: Outer square pattern (4 corners only)
  console.log("\n5️⃣ Testing outer square pattern (4 corners only):");
  const calledNumbers5 = [1, 5, 61, 65]; // Only the 4 corner cells
  const result5 = checkWinningPattern(
    testCard,
    calledNumbers5,
    "outerSquare",
    65
  ); // 65 is the current number
  console.log(
    `   Outer square corners: ${result5.isWinner ? "✅ PASS" : "❌ FAIL"}`
  );
  console.log(`   Status: ${result5.status}`);
  console.log(`   Winning cells: ${result5.winningCells.length}`);
  if (result5.isWinner) {
    console.log(
      `   Expected: 4 cells (corners only), Got: ${result5.winningCells.length}`
    );
    console.log("   Winning cells:", result5.winningCells);
  }

  // Test 6: Inner square pattern (4 corners only)
  console.log("\n6️⃣ Testing inner square pattern (4 corners only):");
  const calledNumbers6 = [17, 19, 47, 49]; // Only the 4 corner cells of inner area
  const result6 = checkWinningPattern(
    testCard,
    calledNumbers6,
    "innerSquare",
    49
  ); // 49 is the current number
  console.log(
    `   Inner square corners: ${result6.isWinner ? "✅ PASS" : "❌ FAIL"}`
  );
  console.log(`   Status: ${result6.status}`);
  console.log(`   Winning cells: ${result6.winningCells.length}`);

  // Test 7: Three line pattern
  console.log("\n7️⃣ Testing 3line pattern:");
  const calledNumbers7 = [
    1,
    16,
    31,
    46,
    61,
    2,
    17,
    32,
    47,
    62,
    3,
    18,
    "FREE",
    48,
    63,
  ]; // Top three rows (horizontal: row 0 + row 1 + row 2)
  const result7 = checkWinningPattern(testCard, calledNumbers7, "3line", 63); // 63 is the current number
  console.log(
    `   Three rows (horizontal): ${result7.isWinner ? "✅ PASS" : "❌ FAIL"}`
  );
  console.log(`   Status: ${result7.status}`);
  console.log(`   Winning cells: ${result7.winningCells.length}`);

  // Test 7b: Vertical pattern (column B)
  console.log("\n7️⃣b Testing vertical pattern (column B):");
  const calledNumbers7b = [1, 2, 3, 4, 5]; // Column B (vertical: B[0], B[1], B[2], B[3], B[4])
  const result7b = checkWinningPattern(testCard, calledNumbers7b, "1line", 5); // 5 is the current number
  console.log(
    `   Column B (vertical): ${result7b.isWinner ? "✅ PASS" : "❌ FAIL"}`
  );
  console.log(`   Status: ${result7b.status}`);
  console.log(`   Winning cells: ${result7b.winningCells.length}`);

  // Test 8: New 2line pattern logic (exactly 2 specific patterns)
  console.log("\n8️⃣ Testing new 2line pattern logic:");
  const calledNumbers8 = [1, 2, 3, 4, 5, 1, 17, "FREE", 49, 65]; // 1 row + 1 diagonal
  const result8 = checkWinningPattern(testCard, calledNumbers8, "2line", 65); // 65 is the current number
  console.log(
    `   2line (1 row + 1 diagonal): ${result8.isWinner ? "✅ PASS" : "❌ FAIL"}`
  );
  console.log(`   Status: ${result8.status}`);

  const calledNumbers8b = [
    1,
    2,
    3,
    4,
    5,
    16,
    17,
    18,
    19,
    20,
    31,
    32,
    "FREE",
    34,
    35,
  ]; // 3 rows (should fail)
  const result8b = checkWinningPattern(testCard, calledNumbers8b, "2line", 35); // 35 is the current number
  console.log(
    `   2line (3 rows - should fail): ${
      result8b.isWinner ? "❌ FAIL" : "✅ PASS"
    }`
  );
  console.log(`   Status: ${result8b.status}`);

  // Test 9: New 3line pattern logic (exactly 3 specific patterns)
  console.log("\n9️⃣ Testing new 3line pattern logic:");
  const calledNumbers9 = [1, 2, 3, 4, 5, 1, 17, "FREE", 49, 65, 1, 5, 61, 65]; // 1 row + 1 diagonal + outer square
  const result9 = checkWinningPattern(testCard, calledNumbers9, "3line", 65); // 65 is the current number
  console.log(
    `   3line (1 row + 1 diagonal + outer square): ${
      result9.isWinner ? "✅ PASS" : "❌ FAIL"
    }`
  );
  console.log(`   Status: ${result9.status}`);

  const calledNumbers9b = [
    1,
    2,
    3,
    4,
    5,
    16,
    17,
    18,
    19,
    20,
    31,
    32,
    "FREE",
    34,
    35,
    46,
    47,
    48,
    49,
    50,
  ]; // 4 rows (should fail)
  const result9b = checkWinningPattern(testCard, calledNumbers9b, "3line", 50); // 50 is the current number
  console.log(
    `   3line (4 rows - should fail): ${
      result9b.isWinner ? "❌ FAIL" : "✅ PASS"
    }`
  );
  console.log(`   Status: ${result9b.status}`);

  console.log("\n🎯 Testing complete!");
}

// NEW: Function to check if a card should lose based on validation criteria
export function checkCardValidation(
  cardId: string,
  card: BingoCard | undefined,
  isInGame: boolean,
  isAlreadyWon: boolean,
  isAlreadyChecked: boolean
): { shouldLose: boolean; reason: string } {
  // Check if card ID is valid
  if (isNaN(Number(cardId))) {
    return { shouldLose: true, reason: "Invalid card number" };
  }

  // Check if card exists
  if (!card) {
    return { shouldLose: true, reason: "Card not found" };
  }

  // Check if card is in current game
  if (!isInGame) {
    return { shouldLose: false, reason: "not_in_game" }; // This is handled separately
  }

  // Check if card already won
  if (isAlreadyWon) {
    return { shouldLose: false, reason: "already_won" }; // This is handled separately
  }

  // Check if card already checked
  if (isAlreadyChecked) {
    return { shouldLose: false, reason: "already_checked" }; // This is handled separately
  }

  // Card passed all validation checks
  return { shouldLose: false, reason: "valid" };
}
