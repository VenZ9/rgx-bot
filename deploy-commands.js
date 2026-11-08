const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const commands = [
    new SlashCommandBuilder().setName('ticket-panel').setDescription('Send the ticket creation panel'),
    new SlashCommandBuilder().setName('ticket-add').setDescription('Add a user to the ticket').addUserOption(o => o.setName('user').setDescription('User to add').setRequired(true)),
    new SlashCommandBuilder().setName('website').setDescription('Get the RGX website link'),
    new SlashCommandBuilder().setName('team-add').setDescription('Add user to a team').addStringOption(o => o.setName('game').setDescription('Game').setRequired(true)).addStringOption(o => o.setName('user').setDescription('Username').setRequired(true)),
    new SlashCommandBuilder().setName('team-remove').setDescription('Remove user from a team').addStringOption(o => o.setName('game').setDescription('Game').setRequired(true)).addStringOption(o => o.setName('user').setDescription('Username').setRequired(true)),
    new SlashCommandBuilder().setName('team-members').setDescription('List team members').addStringOption(o => o.setName('game').setDescription('Game').setRequired(true)),
    new SlashCommandBuilder().setName('ban').setDescription('Ban a user').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)),
    new SlashCommandBuilder().setName('kick').setDescription('Kick a user').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)),
    new SlashCommandBuilder().setName('mute').setDescription('Timeout a user').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)),
    new SlashCommandBuilder().setName('unmute').setDescription('Remove timeout').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)),
    new SlashCommandBuilder().setName('unban').setDescription('Unban a user').addStringOption(o => o.setName('user').setDescription('User ID').setRequired(true))
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    await rest.put(Routes.applicationCommands('YOUR_CLIENT_ID'), { body: commands });
    console.log('Commands registered!');
})();
