import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

config({ path: '.env.local' });
if (getApps().length === 0) {
  const sa = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf-8'));
  initializeApp({ credential: cert(sa) });
}
const db = getFirestore();

async function main() {
  // Check products collection
  const products = await db.collection('products').limit(20).get();
  console.log('\n=== Sample Products ===');
  let withReview = 0;
  let withoutReview = 0;

  for (const doc of products.docs) {
    const d = doc.data();
    const hasReview = d.reviewAverage || d.reviewCount;
    if (hasReview) {
      withReview++;
      console.log(`✓ ${d.name?.substring(0, 50)}...`);
      console.log(`  Review: ${d.reviewAverage || 0} (${d.reviewCount || 0}件)`);
    } else {
      withoutReview++;
      console.log(`✗ ${d.name?.substring(0, 50)}... NO REVIEW`);
    }
  }
  console.log(`\nSample: ${withReview} with reviews, ${withoutReview} without reviews`);

  // Check total counts
  const allProducts = await db.collection('products').get();
  let totalWithReview = 0;
  allProducts.docs.forEach(d => {
    if (d.data().reviewAverage || d.data().reviewCount) totalWithReview++;
  });
  console.log(`Total products: ${allProducts.size}, with reviews: ${totalWithReview}`);

  // Check a specific design's furniture items
  const designId = process.argv[2] || 'NmIICQGGOo01NitA0vjK';
  const items = await db.collection('designs').doc(designId).collection('furnitureItems').get();
  console.log(`\n=== Furniture Items for ${designId} ===`);

  items.docs.forEach(doc => {
    const d = doc.data();
    console.log(`${d.itemNumber}. ${d.name?.substring(0, 40)}...`);
    console.log(`   reviewAverage: ${d.reviewAverage}, reviewCount: ${d.reviewCount}`);
  });
}
main().catch(console.error);
