import { expect, test, type Page } from '@playwright/test';

async function setEditorCode(page: Page, code: string) {
  await page.locator('[aria-label="Code workspace"] .cm-content').click();
  await page.keyboard.press('ControlOrMeta+a');
  // insertText pastes verbatim, bypassing auto-indent and bracket closing.
  await page.keyboard.insertText(code);
}

test('a learner runs code, fails, then passes an exercise and sees progress', async ({ page }) => {
  await page.goto('/');
  // Title screen: loads the music, then waits for the visitor to enter.
  await page.getByRole('button', { name: 'Enter the Shire' }).click();
  await expect(page.getByRole('dialog', { name: 'The Shire is loading' })).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Python Basics' })).toBeVisible();

  await page.goto('/courses/python-basics');
  await page.getByRole('link', { name: /Loops/ }).click();
  await expect(page).toHaveURL(/\/lessons\/python-basics-03$/);

  const terminal = page.getByRole('log', { name: 'Terminal output' });
  const courseProgress = page.getByRole('progressbar', { name: 'Python Basics progress' });
  await expect(courseProgress).toHaveAttribute('aria-valuenow', '0');

  // Run: output appears in the terminal.
  await setEditorCode(page, 'print(sum(range(4)))');
  await page.getByRole('button', { name: 'Run', exact: true }).last().click();
  await expect(terminal).toContainText('6');
  await expect(terminal).toContainText('Finished in');

  // Wrong answer: per-test feedback, hidden tests stay hidden.
  await setEditorCode(page, 'def sum_to(n):\n    return sum(range(n))');
  await page.getByRole('button', { name: 'Submit answer' }).click();
  await expect(terminal).toContainText('0/4 tests passed');
  await expect(terminal).toContainText('Hidden test 3');
  await expect(terminal).not.toContainText('5050');

  // Right answer: success, lesson complete, progress bar moves.
  await setEditorCode(page, 'def sum_to(n):\n    return n * (n + 1) // 2');
  await page.getByRole('button', { name: 'Submit answer' }).click();
  await expect(terminal).toContainText('Exercise complete!');
  await expect(courseProgress).toHaveAttribute('aria-valuenow', '25');
  await expect(page.getByText('Lesson complete', { exact: true })).toBeVisible();

  // The course page reflects it.
  await page.goto('/courses/python-basics');
  await expect(page.getByRole('link', { name: /Loops/ })).toContainText('Done');
});
