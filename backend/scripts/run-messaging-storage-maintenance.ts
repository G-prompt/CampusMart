import {
  prisma,
} from "../src/lib/prisma";

import {
  enforceAllConversationMessageLimits,
  runMessagingRetentionCleanup,
} from "../src/services/messagingRetention.service";

async function main() {
  console.log(
    "\n=== CAMPUSMART MESSAGING STORAGE MAINTENANCE ===\n"
  );

  const retention =
    await runMessagingRetentionCleanup();

  console.log(
    "Retention cleanup:"
  );

  console.log({
    generalAndListingDeleted:
      retention.generalAndListingDeleted,

    orderDeleted:
      retention.orderDeleted,

    totalDeleted:
      retention.totalDeleted,
  });

  const limits =
    await enforceAllConversationMessageLimits();

  console.log(
    "\nMessage-cap cleanup:"
  );

  console.log({
    conversationsChecked:
      limits.conversationsChecked,

    overflowMessagesDeleted:
      limits.deletedCount,
  });

  console.log(
    "\nMessaging storage maintenance complete.\n"
  );
}

main()
  .catch(
    (
      error
    ) => {
      console.error(
        error
      );

      process.exitCode =
        1;
    }
  )
  .finally(
    async () => {
      await prisma.$disconnect();
    }
  );