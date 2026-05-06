export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const MockApi = {
  updateProfile: async (data: any) => {
    await delay(800);
    if (!data.email || !data.email.includes('@')) throw new Error("Invalid email address.");
    return { success: true, message: "Profile updated successfully." };
  },
  
  updateProductivity: async (_data: any) => {
    await delay(600);
    return { success: true, message: "Productivity preferences saved." };
  },

  changePassword: async (data: any) => {
    await delay(1200);
    if (data.currentPassword !== 'password123') throw new Error("Incorrect current password.");
    return { success: true, message: "Password updated successfully." };
  },

  toggle2FA: async (enabled: boolean) => {
    await delay(1000);
    return { success: true, message: `2FA ${enabled ? 'enabled' : 'disabled'} successfully.` };
  },

  logoutSession: async (_sessionId: string) => {
    await delay(500);
    return { success: true, message: "Session terminated." };
  },

  connectOAuth: async (provider: string) => {
    await delay(1500);
    return { success: true, message: `${provider} connected.` };
  },

  disconnectOAuth: async (provider: string) => {
    await delay(800);
    return { success: true, message: `${provider} disconnected.` };
  },

  deactivateAccount: async () => {
    await delay(2000);
    return { success: true, message: "Account deactivated." };
  },

  deleteAccount: async () => {
    await delay(3000);
    return { success: true, message: "Account deleted permanently." };
  }
};
