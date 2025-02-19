require('dotenv').config();  // Carrega as variáveis do .env
const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core'); // Para baixar o áudio do YouTube
const { createWriteStream } = require('fs');
const axios = require('axios');  // Importa axios para requisição HTTP

// Inicializando o bot
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers
    ]
});

const prefix = '-';  // Prefixo dos comandos

// Variável para armazenar o tempo de inicialização do bot
let startTime = Date.now();

// Função para mapear os meses em português para inglês
const mesEmPortuguesParaIngles = {
    janeiro: 'January',
    fevereiro: 'February',
    março: 'March',
    abril: 'April',
    maio: 'May',
    junho: 'June',
    julho: 'July',
    agosto: 'August',
    setembro: 'September',
    outubro: 'October',
    novembro: 'November',
    dezembro: 'December'
};

// Função para formatar o tempo restante
function formatarTempoRestante(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));

    return `${days} dias, ${hours} horas, ${minutes} minutos e ${seconds} segundos`;
}

// Função para validar se a data fornecida é válida
function validarData(dataString) {
    const data = new Date(dataString);
    return !isNaN(data.getTime()); // Retorna true se a data for válida
}

// Função para configurar o timer
let timerTimeout;

function setTimer(message, data) {
    const now = new Date();

    // Substitui o nome do mês em português pelo mês em inglês
    const dataComMesEmIngles = data.split(' ').map((item, index) => {
        if (index === 1) {
            return mesEmPortuguesParaIngles[item.toLowerCase()] || item;
        }
        return item;
    }).join(' ');

    const targetDate = new Date(dataComMesEmIngles);

    if (targetDate <= now) {
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Erro')
            .setDescription('A data fornecida já passou, não está no passado!')
            .setTimestamp();
        message.reply({ embeds: [embed] });
        return;
    }

    const remainingTime = targetDate - now;
    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('Timer configurado')
        .setDescription(`O timer foi configurado para: **${targetDate.toString()}**. O tempo restante é: **${formatarTempoRestante(remainingTime)}**`)
        .setTimestamp();
    
    message.reply({ embeds: [embed] });

    // Configura o timer para enviar uma mensagem quando o tempo acabar
    timerTimeout = setTimeout(() => {
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('⏰ O tempo acabou!')
            .setDescription(`Agora é: ${targetDate.toString()}`)
            .setTimestamp();
        message.reply({ embeds: [embed] });
    }, remainingTime);
}

// Função para procurar imagens usando a API do Unsplash
async function procurarImagem(message, termo) {
    const unsplashAccessKey = process.env.UNSPLASH_ACCESS_KEY; // A chave de API do Unsplash
    const url = `https://api.unsplash.com/search/photos?query=${termo}&client_id=${unsplashAccessKey}`;

    try {
        const resposta = await axios.get(url);
        const fotos = resposta.data.results;

        if (fotos.length === 0) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('Imagem não encontrada')
                .setDescription('Nenhuma imagem foi encontrada para o termo pesquisado.')
                .setTimestamp();
            return message.reply({ embeds: [embed] });
        }

        const imagem = fotos[0]; // Pegando a primeira imagem da lista de resultados

        const embed = new EmbedBuilder()
            .setColor('#0099FF')
            .setTitle(`Resultado da pesquisa: ${termo}`)
            .setImage(imagem.urls.regular) // Exibindo a URL da imagem
            .setFooter({ text: 'Fonte: Unsplash' })
            .setTimestamp();

        message.reply({ embeds: [embed] });

    } catch (erro) {
        console.error(erro);
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Erro ao procurar imagem')
            .setDescription('Houve um erro ao tentar buscar a imagem.')
            .setTimestamp();
        message.reply({ embeds: [embed] });
    }
}

// Função para exibir todos os comandos disponíveis
function exibirComandos(message) {
    const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('Comandos disponíveis')
        .setDescription(` 
            **-olá**: o bot responde com uma saudação.
            **-tempo**: mostra o tempo que o bot tá online.
            **-timer <data> <hora>**: define um timer para uma data e hora específicas.
            **-expulsar @usuario**: expulsa um usuário do servidor.
            **-banir @usuario**: bane um usuário do servidor.
            **-menu**: exibe todos os comandos disponíveis.
            **-userinfo**: exibe informações sobre o usuário que enviou o comando.
            **-ping**: verifica a latência do bot.
            **-serverinfo**: mostra informações sobre o servidor.
            **-avatar @usuario**: exibe o avatar de um usuário específico.
            **-say <mensagem>**: o bot envia uma mensagem em nome do usuário.
            **-tocar <link ou caminho do áudio>**: toca uma música no canal de voz.
            **-entrar**: faz o bot entrar no canal de voz.
            **-sair**: faz o bot sair do canal de voz.
            **-imagem <termo>**: pesquisa uma imagem no Unsplash com base no termo fornecido.
            **-limpar <quantidade>**: limpa uma quantidade específica de mensagens no canal.
        `)
        .setTimestamp();

    message.reply({ embeds: [embed] });
}

// Comando -serverinfo: exibe informações sobre o servidor
function serverInfo(message) {
    const guild = message.guild;

    if (!guild) {
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Erro')
            .setDescription('Não consegui encontrar informações sobre este servidor.')
            .setTimestamp();
        message.reply({ embeds: [embed] });
        return;
    }

    const owner = guild.owner ? guild.owner.user.tag : 'Proprietário não encontrado';

    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('Informações do servidor')
        .addFields(
            { name: 'Nome do servidor', value: guild.name, inline: true },
            { name: 'ID do servidor', value: guild.id, inline: true },
            { name: 'Membros', value: `${guild.memberCount}`, inline: true },
            { name: 'Criado em', value: guild.createdAt.toDateString(), inline: true },
            { name: 'Proprietário', value: owner, inline: true }
        )
        .setTimestamp();
    
    message.reply({ embeds: [embed] });
}

// Comando -avatar: exibe o avatar do usuário mencionado
function avatar(message) {
    const membro = message.mentions.members.first() || message.member;

    if (!membro) {
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Erro')
            .setDescription('Não consegui encontrar o usuário mencionado.')
            .setTimestamp();
        message.reply({ embeds: [embed] });
        return;
    }

    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`${membro.user.tag}'s Avatar`)
        .setImage(membro.user.displayAvatarURL({ format: 'png', dynamic: true }))
        .setTimestamp();
    
    message.reply({ embeds: [embed] });
}

// Comando -say: faz o bot enviar uma mensagem em nome do usuário
function say(message) {
    const texto = message.content.slice(5).trim();
    if (!texto) {
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Erro')
            .setDescription('Você não forneceu uma mensagem para eu dizer!')
            .setTimestamp();
        message.reply({ embeds: [embed] });
        return;
    }
    message.channel.send(texto);
}

// Função para o bot entrar em um canal de voz
function entrarNoCanalDeVoz(message) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Erro')
            .setDescription('Você precisa estar em um canal de voz para eu entrar!')
            .setTimestamp();
        message.reply({ embeds: [embed] });
        return;
    }

    try {
        joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator
        });

        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('Entrando no canal de voz')
            .setDescription(`Estou entrando no canal de voz **${voiceChannel.name}**.`)
            .setTimestamp();
        message.reply({ embeds: [embed] });
    } catch (error) {
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Erro')
            .setDescription('Não consegui entrar no canal de voz!')
            .setTimestamp();
        message.reply({ embeds: [embed] });
        console.error(error);
    }
}

// Função para o bot sair do canal de voz
function sairDoCanalDeVoz(message) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Erro')
            .setDescription('Você precisa estar em um canal de voz para eu sair!')
            .setTimestamp();
        message.reply({ embeds: [embed] });
        return;
    }

    const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator
    });

    connection.destroy();

    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('Saindo do canal de voz')
        .setDescription(`Saindo do canal de voz **${voiceChannel.name}**.`)
        .setTimestamp();
    message.reply({ embeds: [embed] });
}

// Função para exibir informações do usuário
function userInfo(message) {
    const user = message.mentions.users.first() || message.author;
    const member = message.guild.members.cache.get(user.id);

    if (!member) {
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Erro')
            .setDescription('Não consegui encontrar o usuário mencionado.')
            .setTimestamp();
        message.reply({ embeds: [embed] });
        return;
    }

    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`Informações de ${user.tag}`)
        .addFields(
            { name: 'ID', value: user.id, inline: true },
            { name: 'Apelido', value: member.nickname || 'Nenhum', inline: true },
            { name: 'Conta criada em', value: user.createdAt.toDateString(), inline: true },
            { name: 'Entrou no servidor em', value: member.joinedAt.toDateString(), inline: true },
            { name: 'Cargos', value: member.roles.cache.map(role => role.name).join(', '), inline: false }
        )
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();
    
    message.reply({ embeds: [embed] });
}

// Função para expulsar um usuário do servidor
function expulsarUsuario(message) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Erro')
            .setDescription('Você não tem permissão para expulsar usuários.')
            .setTimestamp();
        message.reply({ embeds: [embed] });
        return;
    }

    const usuario = message.mentions.members.first();
    if (!usuario) {
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Erro')
            .setDescription('Você precisa mencionar um usuário para expulsar.')
            .setTimestamp();
        message.reply({ embeds: [embed] });
        return;
    }

    if (!usuario.kickable) {
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Erro')
            .setDescription('Não consigo expulsar este usuário.')
            .setTimestamp();
        message.reply({ embeds: [embed] });
        return;
    }

    usuario.kick()
        .then(() => {
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('Usuário expulso')
                .setDescription(`${usuario.user.tag} foi expulso com sucesso.`)
                .setTimestamp();
            message.reply({ embeds: [embed] });
        })
        .catch(err => {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('Erro')
                .setDescription('Houve um erro ao tentar expulsar o usuário.')
                .setTimestamp();
            message.reply({ embeds: [embed] });
            console.error(err);
        });
}

// Função para banir um usuário do servidor
function banirUsuario(message) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Erro')
            .setDescription('Você não tem permissão para banir usuários.')
            .setTimestamp();
        message.reply({ embeds: [embed] });
        return;
    }

    const usuario = message.mentions.members.first();
    if (!usuario) {
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Erro')
            .setDescription('Você precisa mencionar um usuário para banir.')
            .setTimestamp();
        message.reply({ embeds: [embed] });
        return;
    }

    if (!usuario.bannable) {
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Erro')
            .setDescription('Não consigo banir este usuário.')
            .setTimestamp();
        message.reply({ embeds: [embed] });
        return;
    }

    usuario.ban()
        .then(() => {
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('Usuário banido')
                .setDescription(`${usuario.user.tag} foi banido com sucesso.`)
                .setTimestamp();
            message.reply({ embeds: [embed] });
        })
        .catch(err => {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('Erro')
                .setDescription('Houve um erro ao tentar banir o usuário.')
                .setTimestamp();
            message.reply({ embeds: [embed] });
            console.error(err);
        });
}

// Função para limpar mensagens
async function limparMensagens(message, quantidade) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Erro')
            .setDescription('Você não tem permissão para limpar mensagens.')
            .setTimestamp();
        message.reply({ embeds: [embed] });
        return;
    }

    const quantidadeNumerica = parseInt(quantidade);
    if (isNaN(quantidadeNumerica) || quantidadeNumerica <= 0 || quantidadeNumerica > 100) {
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Erro')
            .setDescription('Forneça um número válido entre 1 e 100.')
            .setTimestamp();
        message.reply({ embeds: [embed] });
        return;
    }

    try {
        await message.channel.bulkDelete(quantidadeNumerica + 1); // +1 para incluir a mensagem do comando
        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('Mensagens limpas')
            .setDescription(`Foram limpas **${quantidadeNumerica}** mensagens.`)
            .setTimestamp();
        message.reply({ embeds: [embed] }).then(msg => setTimeout(() => msg.delete(), 5000));
    } catch (error) {
        console.error(error);
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Erro')
            .setDescription('Houve um erro ao tentar limpar as mensagens.')
            .setTimestamp();
        message.reply({ embeds: [embed] });
    }
}

// Função para verificar a latência do bot
function ping(message) {
    const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('Pong! 🏓')
        .setDescription(`Latência: **${client.ws.ping}ms**`)
        .setTimestamp();
    message.reply({ embeds: [embed] });
}

// Função para mostrar o tempo que o bot está online
function tempoOnline(message) {
    const uptime = Date.now() - startTime;
    const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('Tempo online')
        .setDescription(`Estou online há: **${formatarTempoRestante(uptime)}**`)
        .setTimestamp();
    message.reply({ embeds: [embed] });
}

// Função para tocar um áudio no canal de voz
function tocar(message, url) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Erro')
            .setDescription('Você precisa estar em um canal de voz para tocar áudio!')
            .setTimestamp();
        message.reply({ embeds: [embed] });
        return;
    }

    const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator
    });

    const player = createAudioPlayer();
    const resource = createAudioResource(ytdl(url, { filter: 'audioonly' }));

    player.play(resource);
    connection.subscribe(player);

    player.on(AudioPlayerStatus.Idle, () => {
        connection.destroy();
    });

    player.on('error', error => {
        console.error('Erro ao reproduzir o áudio:', error);
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Erro')
            .setDescription('Houve um erro ao tentar reproduzir o áudio.')
            .setTimestamp();
        message.reply({ embeds: [embed] });
        connection.destroy();
    });

    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('Reproduzindo áudio')
        .setDescription(`Reproduzindo o áudio de: **${url}**`)
        .setTimestamp();
    message.reply({ embeds: [embed] });
}

// Função para responder com uma saudação
function ola(message) {
    const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('Olá!')
        .setDescription(`Olá, ${message.author.username}! Como posso ajudar?`)
        .setTimestamp();
    message.reply({ embeds: [embed] });
}

// Evento que o bot está pronto para uso
client.once('ready', () => {
    console.log(`Logado como ${client.user.tag}`);
    startTime = Date.now(); // Define o tempo de inicialização do bot
});

// Evento que lida com mensagens enviadas no chat
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Comando para exibir comandos
    if (message.content.startsWith(`${prefix}menu`)) {
        exibirComandos(message);
    }

    // Comando para procurar imagens
    if (message.content.startsWith(`${prefix}imagem`)) {
        const termo = message.content.slice(8).trim();
        if (!termo) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('Erro')
                .setDescription('Você precisa fornecer um termo para pesquisa.')
                .setTimestamp();
            message.reply({ embeds: [embed] });
            return;
        }
        await procurarImagem(message, termo);
    }

    // Comando para configurar o timer
    if (message.content.startsWith(`${prefix}timer`)) {
        const data = message.content.slice(7).trim();
        if (!validarData(data)) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('Erro')
                .setDescription('Data inválida. Tente novamente!')
                .setTimestamp();
            message.reply({ embeds: [embed] });
            return;
        }
        setTimer(message, data);
    }

    // Comando para limpar mensagens
    if (message.content.startsWith(`${prefix}limpar`)) {
        const quantidade = message.content.slice(8).trim();
        await limparMensagens(message, quantidade);
    }

    // Comando para verificar a latência do bot
    if (message.content.startsWith(`${prefix}ping`)) {
        ping(message);
    }

    // Comando para mostrar o tempo online do bot
    if (message.content.startsWith(`${prefix}tempo`)) {
        tempoOnline(message);
    }

    // Comando para exibir informações do usuário
    if (message.content.startsWith(`${prefix}userinfo`)) {
        userInfo(message);
    }

    // Comando para expulsar um usuário
    if (message.content.startsWith(`${prefix}expulsar`)) {
        expulsarUsuario(message);
    }

    // Comando para banir um usuário
    if (message.content.startsWith(`${prefix}banir`)) {
        banirUsuario(message);
    }

    // Comando para exibir informações do servidor
    if (message.content.startsWith(`${prefix}serverinfo`)) {
        serverInfo(message);
    }

    // Comando para exibir o avatar de um usuário
    if (message.content.startsWith(`${prefix}avatar`)) {
        avatar(message);
    }

    // Comando para o bot enviar uma mensagem
    if (message.content.startsWith(`${prefix}say`)) {
        say(message);
    }

    // Comando para o bot entrar em um canal de voz
    if (message.content.startsWith(`${prefix}entrar`)) {
        entrarNoCanalDeVoz(message);
    }

    // Comando para o bot sair do canal de voz
    if (message.content.startsWith(`${prefix}sair`)) {
        sairDoCanalDeVoz(message);
    }

    // Comando para tocar áudio
    if (message.content.startsWith(`${prefix}tocar`)) {
        const url = message.content.slice(7).trim();
        if (!url) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('Erro')
                .setDescription('Você precisa fornecer um link ou caminho do áudio.')
                .setTimestamp();
            message.reply({ embeds: [embed] });
            return;
        }
        tocar(message, url);
    }

    // Comando para saudação
    if (message.content.startsWith(`${prefix}olá`)) {
        ola(message);
    }
});

// Logando o bot com o token
client.login(process.env.BOT_TOKEN);