/**
 * 統合コレクションスクリプト
 *
 * 全ての商品収集パイプラインを順番に実行します。
 *
 * 使用方法:
 *   npx tsx scripts/collect-all.ts --all
 *   npx tsx scripts/collect-all.ts --xref --merge
 *   npx tsx scripts/collect-all.ts --all --dry-run
 *
 * オプション:
 *   --articles  記事からの商品収集を実行
 *   --brands    ブランド検索からの商品収集を実行
 *   --xref      楽天→Amazonクロスリファレンスを実行
 *   --merge     候補商品の重複統合を実行
 *   --all       全ステップを実行
 *   --dry-run   書き込みなしで実行（各サブスクリプトに渡される）
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

// ============================================
// CLI引数の解析
// ============================================

const args = process.argv.slice(2);
const runAll = args.includes('--all');
const runArticles = runAll || args.includes('--articles');
const runBrands = runAll || args.includes('--brands');
const runXref = runAll || args.includes('--xref');
const runMerge = runAll || args.includes('--merge');
const isDryRun = args.includes('--dry-run');

// 何も選択されていない場合はヘルプ表示
if (!runArticles && !runBrands && !runXref && !runMerge) {
  console.log(`
============================================================
  商品収集パイプライン
============================================================

使用方法:
  npx tsx scripts/collect-all.ts --all
  npx tsx scripts/collect-all.ts --xref --merge
  npx tsx scripts/collect-all.ts --all --dry-run

オプション:
  --articles  記事からの商品収集を実行
  --brands    ブランド検索からの商品収集を実行
  --xref      楽天→Amazonクロスリファレンスを実行
  --merge     候補商品の重複統合を実行
  --all       全ステップを実行
  --dry-run   書き込みなしで実行

実行順序:
  1. from-articles.ts   (記事収集)
  2. from-brands.ts     (ブランド検索)
  3. from-rakuten-xref.ts (楽天→Amazonクロスリファレンス)
  4. merge-candidates.ts  (重複統合)
`);
  process.exit(0);
}

// ============================================
// ステップ定義
// ============================================

interface Step {
  name: string;
  scriptPath: string;
  enabled: boolean;
}

const STEPS: Step[] = [
  {
    name: '記事からの商品収集',
    scriptPath: 'scripts/collect/from-articles.ts',
    enabled: runArticles,
  },
  {
    name: 'ブランド検索からの商品収集',
    scriptPath: 'scripts/collect/from-brands.ts',
    enabled: runBrands,
  },
  {
    name: '楽天→Amazonクロスリファレンス',
    scriptPath: 'scripts/collect/from-rakuten-xref.ts',
    enabled: runXref,
  },
  {
    name: '候補商品の重複統合',
    scriptPath: 'scripts/collect/merge-candidates.ts',
    enabled: runMerge,
  },
];

// ============================================
// スクリプト実行
// ============================================

/**
 * サブスクリプトを実行
 */
function runScript(step: Step): { success: boolean; durationMs: number } {
  const fullPath = join(process.cwd(), step.scriptPath);

  if (!existsSync(fullPath)) {
    console.log(`  [SKIP] スクリプトが存在しません: ${step.scriptPath}`);
    return { success: false, durationMs: 0 };
  }

  const dryRunFlag = isDryRun ? ' --dry-run' : '';
  const command = `npx tsx ${step.scriptPath}${dryRunFlag}`;

  console.log(`  実行: ${command}`);

  const startTime = Date.now();

  try {
    execSync(command, {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: process.env,
      timeout: 600000, // 10分タイムアウト
    });

    const durationMs = Date.now() - startTime;
    return { success: true, durationMs };
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    console.error(`  エラー: ${error.message || 'スクリプトの実行に失敗しました'}`);
    return { success: false, durationMs };
  }
}

// ============================================
// メイン処理
// ============================================

function main() {
  const enabledSteps = STEPS.filter((s) => s.enabled);

  console.log('='.repeat(60));
  console.log(`  商品収集パイプライン ${isDryRun ? '(DRY RUN)' : ''}`);
  console.log('='.repeat(60));
  console.log(`\n実行ステップ:`);
  for (const step of enabledSteps) {
    console.log(`  - ${step.name}`);
  }
  console.log('');

  const results: { name: string; success: boolean; durationMs: number }[] = [];
  const overallStart = Date.now();

  for (let i = 0; i < enabledSteps.length; i++) {
    const step = enabledSteps[i];

    console.log('\n' + '-'.repeat(60));
    console.log(`  ステップ ${i + 1}/${enabledSteps.length}: ${step.name}`);
    console.log('-'.repeat(60));

    const result = runScript(step);
    results.push({
      name: step.name,
      success: result.success,
      durationMs: result.durationMs,
    });

    if (!result.success) {
      console.log(`\n  "${step.name}" が失敗しました。次のステップに進みます。`);
    }
  }

  const overallDurationMs = Date.now() - overallStart;

  // サマリーレポート
  console.log('\n' + '='.repeat(60));
  console.log('  パイプライン実行結果');
  console.log('='.repeat(60));

  for (const result of results) {
    const status = result.success ? 'OK' : 'FAIL';
    const duration = (result.durationMs / 1000).toFixed(1);
    console.log(`  [${status}] ${result.name} (${duration}s)`);
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;
  const totalDuration = (overallDurationMs / 1000).toFixed(1);

  console.log(`\n  成功: ${successCount}, 失敗: ${failCount}, 合計時間: ${totalDuration}s`);
  console.log('='.repeat(60));

  if (failCount > 0) {
    process.exit(1);
  }
}

main();
