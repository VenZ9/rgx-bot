require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, ChannelType, StringSelectMenuBuilder } = require('discord.js');
const Database = require('better-sqlite3');
const discordTranscripts = require('discord-html-transcripts');

const db = new Database('rgx.db');

// Initialize Database
db.exec(`
CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channelId TEXT,
    userId TEXT,
    type TEXT,
    status TEXT,
    reportedUser TEXT
);
CREATE TABLE IF NOT EXISTS teams (
    game TEXT,
    username TEXT
);
`);

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent] });

client.once('ready', () => {
    console.log(`🤖 RGX Bot logged in as ${client.user.tag}!`);
});

// Helper to check staff
const isStaff = (member) => member.roles.cache.has(process.env.STAFF_ROLE_ID) || member.permissions.has(PermissionsBitField.Flags.Administrator);

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand() && !interaction.isButton() && !interaction.isStringSelectMenu()) return;

    // === MODERATION COMMANDS ===
    if (interaction.isChatInputCommand() && ['ban', 'kick', 'mute', 'unmute', 'unban'].includes(interaction.commandName)) {
        if (!isStaff(interaction.member)) return interaction.reply({ content: 'You do not have permission.', ephemeral: true });
        
        const target = interaction.options.getMember('user');
        if (!target) return interaction.reply({ content: 'User not found.', ephemeral: true });

        if (interaction.commandName === 'ban') {
            await target.ban({ reason: interaction.options.getString('reason') || 'No reason provided' });
            interaction.reply({ content: `Banned ${target.user.tag}.` });
        } else if (interaction.commandName === 'kick') {
            await target.kick(interaction.options.getString('reason') || 'No reason provided');
            interaction.reply({ content: `Kicked ${target.user.tag}.` });
        } else if (interaction.commandName === 'mute') {
            await target.timeout(60 * 60 * 1000, 'Muted by staff'); // 1 hour timeout
            interaction.reply({ content: `Muted ${target.user.tag} for 1 hour.` });
        } else if (interaction.commandName === 'unmute') {
            await target.timeout(null);
            interaction.reply({ content: `Unmuted ${target.user.tag}.` });
        } else if (interaction.commandName === 'unban') {
            await interaction.guild.members.unban(target.id);
            interaction.reply({ content: `Unbanned ${target.user.tag}.` });
        }
    }

    // === WEBSITE COMMAND ===
    if (interaction.isChatInputCommand() && interaction.commandName === 'website') {
        const embed = new EmbedBuilder()
            .setTitle('🌐 RGX Esports Website')
            .setColor('#c3001a')
            .setDescription('[Click here to visit our website!](https://your-vercel-url.vercel.app)');
        interaction.reply({ embeds: [embed] });
    }

    // === TEAM COMMANDS ===
    if (interaction.isChatInputCommand() && interaction.commandName.startsWith('team')) {
        if (!isStaff(interaction.member)) return interaction.reply({ content: 'You do not have permission.', ephemeral: true });
        const game = interaction.options.getString('game');
        const user = interaction.options.getString('user');

        if (interaction.commandName === 'team-add') {
            db.prepare('INSERT INTO teams (game, username) VALUES (?, ?)').run(game, user);
            interaction.reply({ content: `Added **${user}** to the **${game}** roster.` });
        } else if (interaction.commandName === 'team-remove') {
            db.prepare('DELETE FROM teams WHERE game = ? AND username = ?').run(game, user);
            interaction.reply({ content: `Removed **${user}** from the **${game}** roster.` });
        } else if (interaction.commandName === 'team-members') {
            const members = db.prepare('SELECT username FROM teams WHERE game = ?').all(game);
            if (members.length === 0) return interaction.reply({ content: `No members in **${game}**.` });
            const list = members.map(m => `• ${m.username}`).join('\n');
            const embed = new EmbedBuilder().setTitle(`🎮 ${game} Roster`).setDescription(list).setColor('#c3001a');
            interaction.reply({ embeds: [embed] });
        }
    }

    // === TICKET PANEL CREATION (/ticket-panel) ===
    if (interaction.isChatInputCommand() && interaction.commandName === 'ticket-panel') {
        if (!isStaff(interaction.member)) return interaction.reply({ content: 'You do not have permission.', ephemeral: true });

        const embed = new EmbedBuilder()
            .setTitle('🎫 RGX Ticket System')
            .setDescription('Please select the type of ticket you want to open below.')
            .setColor('#c3001a');

        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('ticket_select')
                .setPlaceholder('Select Ticket Type')
                .addOptions([
                    { label: 'Support Ticket', value: 'support', description: 'Get help from our staff' },
                    { label: 'Report a Player', value: 'report', description: 'Report a rule breaker' }
                ])
        );
        interaction.reply({ embeds: [embed], components: [menu] });
    }

    // === TICKET CREATION HANDLER ===
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
        const type = interaction.values[0];
        const categoryId = 'YOUR_CATEGORY_ID_HERE'; // Replace with your Category ID
        const supportRoleId = process.env.STAFF_ROLE_ID;
        const logChannelId = 'YOUR_TRANSCRIPT_LOG_ID'; // Replace with your Log Channel ID

        // Generate ID
        const count = db.prepare('SELECT COUNT(*) as count FROM tickets').get().count;
        const ticketId = `Ticket${String(count + 1).padStart(3, '0')}`;
        
        // Create Channel
        const channel = await interaction.guild.channels.create({
            name: `${ticketId}-${interaction.user.username}`,
            type: ChannelType.GuildText,
            parent: categoryId,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: supportRoleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
            ]
        });

        // Save to DB
        db.prepare('INSERT INTO tickets (channelId, userId, type) VALUES (?, ?, ?)').run(channel.id, interaction.user.id, type);

        const welcomeEmbed = new EmbedBuilder()
            .setTitle(`Welcome to ${ticketId}`)
            .setDescription(`Hello <@${interaction.user.id}>, please write your problem below. A staff member will be with you shortly.`)
            .setColor('#c3001a');

        const closeBtn = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger)
        );

        await channel.send({ content: `<@&${supportRoleId}> <@${interaction.user.id}>`, embeds: [welcomeEmbed], components: [closeBtn] });
        interaction.reply({ content: `Ticket created: <#${channel.id}>`, ephemeral: true });
    }

    // === TICKET CLOSE BUTTON ===
    if (interaction.isButton() && interaction.customId === 'close_ticket') {
        await interaction.reply({ content: 'Closing ticket in 3 seconds...', ephemeral: true });
        setTimeout(async () => {
            const ticketData = db.prepare('SELECT * FROM tickets WHERE channelId = ?').get(interaction.channelId);
            const logChannel = await client.channels.fetch('YOUR_TRANSCRIPT_LOG_ID');
            const attachment = await discordTranscripts.createTranscript(interaction.channel);

            const logEmbed = new EmbedBuilder()
                .setTitle(`Ticket Closed: ${ticketData ? 'Ticket' + ticketData.id : 'Unknown'}`)
                .setColor('#FF0000')
                .setDescription(`Closed by ${interaction.user.tag}`);
            
            await logChannel.send({ embeds: [logEmbed], files: [attachment] });
            db.prepare('DELETE FROM tickets WHERE channelId = ?').run(interaction.channelId);
            await interaction.channel.delete();
        }, 3000);
    }

    // === TICKET ADD COMMAND ===
    if (interaction.isChatInputCommand() && interaction.commandName === 'ticket-add') {
        const user = interaction.options.getMember('user');
        if (!user) return interaction.reply({ content: 'User not found.', ephemeral: true });
        await interaction.channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true });
        interaction.reply({ content: `${user} has been added to the ticket.` });
    }
});

client.login(process.env.DISCORD_TOKEN);
