import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { fetchAvatars, selectAvatar } from "./fetch-heygen-avatar.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, "../config/heygen-avatar.json");

async function run() {
  console.log("🚀 HeyGen Avatar Config Export Script\n");
  
  const avatars = await fetchAvatars();
  
  if (!avatars) {
    console.error("\n❌ Could not fetch avatars from API.");
    console.error("   The avatar.list endpoint may be restricted (403 Forbidden).");
    console.error("\n💡 Solution: Manual Avatar Setup");
    console.error("   1. Get a public avatar ID from HeyGen dashboard or support");
    console.error("   2. Copy config/heygen-avatar.json.template to config/heygen-avatar.json");
    console.error("   3. Replace REPLACE_WITH_ACTUAL_AVATAR_ID with the actual avatar ID");
    console.error("   4. Commit the file to Git");
    process.exit(1);
  }
  
  const selected = selectAvatar(avatars);

  if (!selected) {
    console.error("❌ No suitable avatar found matching criteria. Cannot create config.");
    console.error("\n💡 Solution: Manual Avatar Setup");
    console.error("   1. Get a public avatar ID from HeyGen dashboard or support");
    console.error("   2. Copy config/heygen-avatar.json.template to config/heygen-avatar.json");
    console.error("   3. Replace REPLACE_WITH_ACTUAL_AVATAR_ID with the actual avatar ID");
    console.error("   4. Commit the file to Git");
    process.exit(1);
  }

  // Build config object with metadata (matching saveAvatarConfig format)
  const config = {
    avatar_id: selected.avatar_id,
    name: selected.name,
    gender: selected.gender,
    style: selected.style,
    score: selected.score,
    selectedAt: new Date().toISOString(),
    source: 'HeyGen API v1/avatar.list',
    criteria: {
      mustBePublic: true,
      mustBeFemaleOrNeutral: true,
      mustBeProfessionalNeutralOrNatural: true,
      mustNotBeChildCartoonFantasyRobotDramatic: true,
    },
  };

  console.log("\n=== SELECTED AVATAR CONFIG ===\n");
  console.log(JSON.stringify(config, null, 2));

  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
  console.log(`\n💾 Saved configuration to: ${CONFIG_PATH}`);
}

run().catch(error => {
  console.error("❌ Script failed:", error);
  process.exit(1);
});

