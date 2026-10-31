import mongoose from "mongoose";

const run = async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  await mongoose.connect(process.env.MONGODB_URI);
  const collection = mongoose.connection.collection("purchasereturns");
  const indexes = await collection.listIndexes().toArray();
  const legacy = indexes.filter(
    (index: any) =>
      index.unique &&
      JSON.stringify(index.key) ===
        JSON.stringify({ companyId: 1, purchaseBillId: 1 }),
  );
  const duplicates = await collection
    .aggregate([
      {
        $group: {
          _id: { companyId: "$companyId", purchaseBillId: "$purchaseBillId" },
          count: { $sum: 1 },
          ids: { $push: "$_id" },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();
  console.log(
    JSON.stringify(
      {
        dryRun: true,
        legacyUniqueIndexes: legacy.map((index: any) => index.name),
        duplicatePurchaseBillGroups: duplicates,
        recommendation: legacy.length
          ? "Review duplicates, then drop the legacy unique index in a controlled non-production migration before enabling multiple partial returns."
          : "No legacy unique PurchaseReturn index detected.",
      },
      null,
      2,
    ),
  );
  await mongoose.disconnect();
};
run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
