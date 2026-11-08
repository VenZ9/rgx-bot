const express = require('express');
const multer = require('multer');
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Database = require('better-sqlite3');
require('dotenv').config();

const db = new Database('rgx.db');
const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.login(process.env.DISCORD_TOKEN);

app.use(express.json());
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// 1. Website sends registration here
app.post('/api/register', upload.single('file'), async (req, res) => {
    try {
        const { name, discordTag, age, game, rank, role } = req.body;
        const channel = await client.channels.fetch(process.env.REGISTRATION_CHANNEL_ID);
        
        const embed = new EmbedBuilder()
            .setTitle(`🎮 Registration: ${game}`)
            .setColor('#c3001a')
            .addFields(
                { name: 'Name', value: name, inline: true },
                { name: 'Discord', value: discordTag, inline: true },
                { name: 'Age', value: age, inline: true },
                { name: 'Game', value: game, inline: true },
                { name: 'Rank', value: rank, inline: true },
                { name: 'Role', value: role, inline: true }
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`accept_${name}_${discordTag}_${game}`).setLabel('Accept').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`reject_${name}_${discordTag}_${game}`).setLabel('Reject').setStyle(ButtonStyle.Danger)
        );

        const msg = { embeds: [embed], components: [row] };
        if (req.file) msg.files = [{ attachment: req.file.buffer, name: req.file.originalname }];
        
        await channel.send(msg);
        res.status(200).send("Success");
    } catch (e) { res.status(500).send("Error"); }
});

// 2. Website fetches teams here
app.get('/api/teams', (req, res) => {
    const teams = db.prepare('SELECT * FROM teams').all();
    res.json(teams);
});

app.listen(process.env.PORT || 3001, () => console.log('🌐 API running'));

// Handle Registration Accept/Reject (Placed here so it shares the client)
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    const [action, name, tag, game] = interaction.customId.split('_');
    
    if (!interaction.member.permissions.has('Administrator')) return interaction.reply({ content: 'No permission.', ephemeral: true });
    
    if (action === 'accept') {
        db.prepare('INSERT INTO teams (game, username) VALUES (?, ?)').run(game, name);
        await interaction.reply({ content: `${name} accepted and added to ${game} roster.`, ephemeral: true });
        interaction.message.edit({ components: [] });
    } else if (action === 'reject') {
        await interaction.reply({ content: `${name} rejected.`, ephemeral: true });
        interaction.message.delete();
    }
});
