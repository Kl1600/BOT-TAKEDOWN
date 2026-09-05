import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  Routes,
  SlashCommandBuilder,
  TextDisplayBuilder
} from 'discord.js';
import { checkPermissions } from '../../middlewares/permissionCheck.js';
import { skipV2Footer } from '../../utils/v2Helper.js';
import config from '../../config/config.js';

const translateHint = '-# 🇬🇧 Click below to translate to English.';

const REGLEMENT_CP_FRENCH_SECTIONS = [
  `### RÈGLEMENT - COURSES POURSUITES

En participant aux **courses poursuites de Takedown**, vous acceptez l’intégralité du règlement ci-dessous.`,
  `### 1.0 - FAIR-PLAY

**1.1 - Comportement**
Les insultes, comportements toxiques, provocations abusives, propos discriminatoires ainsi que toute **incitation à la haine, au harcèlement ou à la discrimination** sont strictement interdits.

**1.2 - Fair-play**
Tout comportement visant à obtenir volontairement un avantage injuste sur son adversaire est interdit.`,
  `### 2.0 - CONDUITE

**2.1 - Zones interdites**
Il est interdit d’emprunter volontairement :

- Les escaliers
- Les souterrains
- Les montagnes
- Les toits
- Toute zone non prévue pour une conduite normale

**2.2 - Jumps & Stunts**
Les jumps, stunts et manœuvres aériennes utilisés volontairement pour réaliser une feinte ou obtenir un avantage sont interdits.

Un saut non détecté par l’anti-jump **ne signifie pas qu’il est autorisé**.

**2.3 - Props**
L’utilisation volontaire d’un prop ou d’un élément du décor pour réaliser une feinte ou obtenir un avantage est interdite.

**2.4 - Air Control**
L’Air Control est désactivé. Toute tentative de contournement est interdite.

**2.5 - Véhicule retourné**
Si votre véhicule se retourne et ne peut plus poursuivre la manche, **celle-ci est considérée comme perdue**.`,
  `### 3.0 - COLLISIONS

**3.1 - PIT**
Tout PIT ou contact volontaire visant à déstabiliser l’adversaire est interdit.

**3.2 - Collision accidentelle**
Si une collision accidentelle pénalise fortement votre adversaire, vous devez lui laisser la possibilité de repartir.

**3.3 - Poussée & Blocage**
Il est interdit de pousser, bloquer ou gêner volontairement la trajectoire de son adversaire avec son véhicule.

**3.4 - Abus anti-PIT**
Toute tentative d’abuser du système anti-PIT est interdite, notamment :

- Brake check volontaire
- Queue de poisson abusive
- Blocage volontaire
- Provocation volontaire d’une collision`,
  `### 4.0 - TRICHE & MODIFICATIONS

**4.1 - FOV**
Toute modification du FOV procurant un avantage compétitif est interdite.

**4.2 - Packs graphiques**
Tout pack graphique modifiant la visibilité dans le but d’obtenir un avantage est interdit.

**4.3 - No Props**
Toute modification supprimant ou rendant invisibles des éléments du jeu est interdite, notamment :

- No Bush
- No Water
- No Props
- Toute modification similaire

**4.4 - Bugs, Glitches & Exploits**
L’utilisation volontaire d’un bug, glitch ou d’une mécanique détournée afin d’obtenir un avantage est interdite.

**4.5 - Logiciels externes**
Tout cheat, injecteur ou logiciel procurant un avantage compétitif est strictement interdit.`,
  `### 5.0 - ELO & MATCHMAKING

**5.1 - Farm ELO**
Toute méthode visant à gagner ou faire perdre artificiellement de l’ELO est interdite.

**5.2 - Arrangement de match**
Les défaites volontaires et arrangements entre joueurs concernant le résultat d’un match sont interdits.

**5.3 - Manipulation du matchmaking**
Toute exploitation du matchmaking dans le but de manipuler son classement ou faciliter sa progression est interdite.

Toute manipulation avérée pourra entraîner **le retrait ou la réinitialisation de l’ELO**.`,
  `### 6.0 - SANCTIONS

**6.1 - Application**
Toute infraction peut entraîner une perte de manche, une perte de match, une modification de l’ELO ou une sanction administrative selon la gravité des faits.

**6.2 - Récidive**
Toute récidive peut entraîner une aggravation de la sanction.

**6.3 - Abus non mentionnés**
Le fait qu’une pratique ne soit pas explicitement mentionnée dans ce règlement ne signifie pas qu’elle est autorisée. Tout abus procurant un avantage injuste peut être sanctionné.

**6.4 - Décision du staff**
Le staff **Takedown** se réserve le droit d’appliquer une sanction adaptée selon les faits et les preuves disponibles.`,
  `**La participation aux courses poursuites implique l’acceptation et le respect de l’intégralité de ce règlement.**`
];

export const REGLEMENT_CP_ENGLISH_SECTIONS = [
  `### PURSUIT RULES

By participating in **Takedown pursuits**, you accept all the rules below.`,
  `### 1.0 - FAIR PLAY

**1.1 - Behaviour**
Insults, toxic behaviour, excessive provocation, discriminatory remarks, and any **incitement to hatred, harassment, or discrimination** are strictly prohibited.

**1.2 - Fair play**
Any behaviour deliberately intended to gain an unfair advantage over an opponent is prohibited.`,
  `### 2.0 - DRIVING

**2.1 - Prohibited areas**
Deliberately driving through the following areas is prohibited:

- Stairs
- Underground areas
- Mountains
- Rooftops
- Any area not intended for normal driving

**2.2 - Jumps & Stunts**
Jumps, stunts, and aerial manoeuvres deliberately used to perform a fake or gain an advantage are prohibited.

A jump not detected by the anti-jump system **does not mean it is allowed**.

**2.3 - Props**
Deliberately using a prop or part of the environment to perform a fake or gain an advantage is prohibited.

**2.4 - Air Control**
Air Control is disabled. Any attempt to bypass this restriction is prohibited.

**2.5 - Overturned vehicle**
If your vehicle overturns and cannot continue the round, **the round is considered lost**.`,
  `### 3.0 - COLLISIONS

**3.1 - PIT**
Any deliberate PIT manoeuvre or contact intended to destabilise an opponent is prohibited.

**3.2 - Accidental collision**
If an accidental collision heavily disadvantages your opponent, you must allow them to get moving again.

**3.3 - Pushing & Blocking**
Deliberately pushing, blocking, or obstructing your opponent’s path with your vehicle is prohibited.

**3.4 - Anti-PIT abuse**
Any attempt to abuse the anti-PIT system is prohibited, including:

- Deliberate brake checking
- Excessive cutting off
- Deliberate blocking
- Deliberately causing a collision`,
  `### 4.0 - CHEATING & MODIFICATIONS

**4.1 - FOV**
Any FOV modification providing a competitive advantage is prohibited.

**4.2 - Graphics packs**
Any graphics pack that changes visibility to provide an advantage is prohibited.

**4.3 - No Props**
Any modification that removes or makes game elements invisible is prohibited, including:

- No Bush
- No Water
- No Props
- Any similar modification

**4.4 - Bugs, Glitches & Exploits**
Deliberately using a bug, glitch, or unintended mechanic to gain an advantage is prohibited.

**4.5 - External software**
Any cheat, injector, or software providing a competitive advantage is strictly prohibited.`,
  `### 5.0 - ELO & MATCHMAKING

**5.1 - ELO farming**
Any method intended to artificially gain or lose ELO is prohibited.

**5.2 - Match fixing**
Deliberate losses and arrangements between players regarding the outcome of a match are prohibited.

**5.3 - Matchmaking manipulation**
Exploiting matchmaking to manipulate your ranking or make progression easier is prohibited.

Confirmed manipulation may result in **ELO being removed or reset**.`,
  `### 6.0 - SANCTIONS

**6.1 - Enforcement**
Any violation may result in the loss of a round, the loss of a match, an ELO adjustment, or an administrative sanction depending on its severity.

**6.2 - Repeat offences**
Repeated violations may result in a more severe sanction.

**6.3 - Unlisted abuses**
The fact that a practice is not explicitly mentioned in these rules does not mean it is allowed. Any abuse providing an unfair advantage may be sanctioned.

**6.4 - Staff decision**
The **Takedown** staff reserves the right to apply an appropriate sanction based on the facts and available evidence.`,
  `**Participation in pursuits implies acceptance of and compliance with all these rules.**`
];

function buildReglementCpBatches(sections, withTranslateButton = false) {
  const containers = sections.map((section, index) => {
    const isLastSection = index === sections.length - 1;
    const compactSection = section.replace(/^(###[^\n]+)\n\n/, '$1\n');
    const content = isLastSection && withTranslateButton
      ? `${compactSection}\n\n${translateHint}`
      : compactSection;
    const container = new ContainerBuilder()
      .setAccentColor(config.colors.primary)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(content));

    if (!isLastSection) skipV2Footer(container);

    if (isLastSection && withTranslateButton) {
      container.addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('msg_translate_reglementcp')
            .setLabel('🇬🇧 Translate')
            .setStyle(ButtonStyle.Secondary)
        )
      );
    }

    return container;
  });

  return [containers];
}

function buildReglementCpFrenchBatches() {
  return buildReglementCpBatches(REGLEMENT_CP_FRENCH_SECTIONS, true);
}

export function buildReglementCpEnglishBatches() {
  return buildReglementCpBatches(REGLEMENT_CP_ENGLISH_SECTIONS);
}

async function sendReglementCp(channel) {
  const batches = buildReglementCpFrenchBatches();
  for (const containers of batches) {
    await channel.client.rest.post(Routes.channelMessages(channel.id), {
      body: {
        components: containers.map(container => container.toJSON()),
        flags: MessageFlags.IsComponentsV2
      }
    });
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('reglementcp')
    .setDescription('Envoyer le règlement des courses poursuites'),

  async executeSlash(interaction) {
    if (!await checkPermissions(interaction, interaction.member)) return;

    const [firstBatch, ...remainingBatches] = buildReglementCpFrenchBatches();
    await interaction.reply({
      components: firstBatch,
      flags: MessageFlags.IsComponentsV2
    });

    for (const batch of remainingBatches) {
      await interaction.followUp({
        components: batch,
        flags: MessageFlags.IsComponentsV2
      });
    }
  },

  async executePrefix(message) {
    if (!await checkPermissions(message, message.member)) return;

    await message.delete().catch(() => null);
    await sendReglementCp(message.channel);
  }
};
