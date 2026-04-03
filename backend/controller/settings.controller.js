import Settings from "../model/settings.js";

// GET /api/settings - Get current settings
export const getSettings = async (req, res) => {
  try {
    const settings = await Settings.getSettings();

    // Initialize waitingRoomDuration from schema default if missing (one-time migration)
    if (
      settings.systemGames &&
      settings.systemGames.waitingRoomDuration === undefined
    ) {
      // Get default from schema
      const schemaDefault = Settings.schema.path(
        "systemGames.waitingRoomDuration"
      ).defaultValue;
      settings.systemGames.waitingRoomDuration = schemaDefault || 60;
      settings.markModified("systemGames");
      await settings.save();
    }

    res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch settings",
      error: error.message,
    });
  }
};

// PUT /api/settings - Update settings
export const updateSettings = async (req, res) => {
  try {
    console.log("Received settings update:", JSON.stringify(req.body, null, 2));
    let settings = await Settings.findOne();

    if (!settings) {
      // Create new settings if none exist
      settings = new Settings(req.body);
      await settings.save();
    } else {
      // Update existing settings
      // Only update fields that are provided
      if (req.body.systemGames) {
        console.log(
          "Updating systemGames:",
          JSON.stringify(req.body.systemGames, null, 2)
        );
        settings.systemGames = {
          ...settings.systemGames,
          ...req.body.systemGames,
        };
        // Mark nested object as modified so Mongoose saves it
        settings.markModified("systemGames");
      }
      if (req.body.userGames) {
        settings.userGames = {
          ...settings.userGames,
          ...req.body.userGames,
        };
        settings.markModified("userGames");
      }
      if (req.body.spin) {
        settings.spin = {
          ...settings.spin,
          ...req.body.spin,
        };
        settings.markModified("spin");
      }
      if (req.body.welcomeBonus) {
        settings.welcomeBonus = {
          ...settings.welcomeBonus,
          ...req.body.welcomeBonus,
        };
        settings.markModified("welcomeBonus");
      }
      if (req.body.referral) {
        settings.referral = {
          ...settings.referral,
          ...req.body.referral,
        };
        settings.markModified("referral");
      }
      if (req.body.withdrawal) {
        settings.withdrawal = {
          ...settings.withdrawal,
          ...req.body.withdrawal,
        };
        settings.markModified("withdrawal");
      }

      await settings.save();
      console.log(
        "Settings saved. waitingRoomDuration:",
        settings.systemGames?.waitingRoomDuration
      );
    }

    res.status(200).json({
      success: true,
      message: "Settings updated successfully",
      data: settings,
    });
  } catch (error) {
    console.error("Error updating settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update settings",
      error: error.message,
    });
  }
};

// GET /api/settings/system-games/stakes - Get only game stakes (public endpoint)
export const getGameStakes = async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    res.status(200).json({
      success: true,
      data: {
        gameStakes: settings.systemGames.gameStakes || [10, 20, 50, 100],
      },
    });
  } catch (error) {
    console.error("Error fetching game stakes:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch game stakes",
      error: error.message,
    });
  }
};

// GET /api/settings/system-games - Get all system game settings (public endpoint)
export const getSystemGameSettings = async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    res.status(200).json({
      success: true,
      data: {
        maxPlayers: settings.systemGames?.maxPlayers ?? 100,
        minStake: settings.systemGames?.minStake ?? 10,
        maxStake: settings.systemGames?.maxStake ?? 1000,
        callInterval: settings.systemGames?.callInterval ?? 5,
        // IMPORTANT: winCut can legitimately be 0, so don't use `||` here.
        winCut: settings.systemGames?.winCut ?? 10,
        gameStakes: settings.systemGames?.gameStakes ?? [10, 20, 50, 100],
        waitingRoomDuration: settings.systemGames?.waitingRoomDuration ?? 60,
      },
    });
  } catch (error) {
    console.error("Error fetching system game settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch system game settings",
      error: error.message,
    });
  }
};
