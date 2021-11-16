const puppeteer = require('puppeteer');

const url = 'https://adecampus.univ-jfc.fr/direct/index.jsp?data=02427bf08a4e3905df54e3828781966417a0456235d61df4705fb52a51c95d7ffb650adbf17b96d5d97cc32ac608bd13facd4837bfc6fce1bd5d96a07a04824c5823238300f7365f22d90e079254e14d6a818c4c1a069cb98a008d7020f28ba25b66babf80b753289969c1b1e23d701d8a96fc2bd08f9dcf79c796321f919fe8bce01058236ed18878168cf46b2a937d2d2d5b9bb5b4cfc3e41a0fb5035c09561ec7656b708e82cc6634e50913e2a166074e24568258ccc0a0cbc04889b0dae1,1';
const sel = '#x-auto-99-input';

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  ////////////// Démarage et recherche de l'url //////////////
  const browser = await puppeteer.launch({
    args: [`--window-size=2000,1080`],
    defaultViewport: null
  }); /*{
      headless: false, // The browser is visible
      ignoreHTTPSErrors: true,
      args: [`--window-size=2000,1080`], // new option
      defaultViewport: null
  }*/
  const page = await browser.newPage();
  await page.goto  (url);
  await page.screenshot({ path: 'screen.png' });
  // var intervalID = setInterval(() => page.screenshot({ path: 'screen.png' }), 200);

  ////////////// Recherche de l'emploi du temps //////////////
  // const frame = page.frames().find(frame => frame.url() === url);
  let input = await page.waitForSelector(sel);
  await timeout(100); // Sans ça ça marche une fois sur deux

  await page.$eval(sel, input => input.setAttribute('value', '21L3-INF'))
  // await input.type('21L3-INF'); // await page.keyboard.type('21L3-INF');
  await input.press('Enter'); // await page.keyboard.press('Enter');

  await page.screenshot({ path: 'screen.png' });

  await page.waitForSelector('#Planning');
  await page.screenshot({ path: 'screen.png' });


  ////////////// Récupération de l'emploi du temps //////////////
  const matieres = await page.evaluate((filiere) => {
    let i = 0;
    let element;
    const matieres = [];
    const nbHour = (21.3-8);
    const {clientWidth: maxWidth, clientHeight: maxHeight} = document.getElementById('Planning');
    ////////////// Traitement de texte //////////////
    const getGroup = (text) => {
      let group;
      const i = text.indexOf('Groupe-');
      if (i >= 0) {
        group = text.charAt(i+7)
        if (group == '0')
          group = text.charAt(i+8)
      }
      return group;
    }
    const getSalle = (text) => text.substring(
        text.indexOf('<br>ALB') + 7,
        text.lastIndexOf('<br>')
      ).replace(/ALB/g, '').trim();

    ////////////// Jour et Horaire //////////////
    const toHour = width => {
      const h = width * (nbHour/maxWidth);
      let hours = Math.round(h);
      let m = (h-hours) * 100;

      let closestDif = m,
        minutes = 0;
      for (const norm of [25, 50, 75]) {
        const dif = Math.abs(norm - m);
        if (dif < closestDif) {
          closestDif = dif;
          minutes = norm * 0.6
        }
      }
      return new Date(0).setMinutes(minutes).setHours(hours)//`${hours}:${minutes}:00`;
    };

    // Tant que l'on a des matières à traiter
    while (element = document.getElementById('inner'+i)) {
      const text = element.innerHTML;
      const div = document.getElementById('div'+i);
      const parent = div.parentElement;

      matieres.push({
        //filiere,
        titre: element.firstChild.innerHTML,
        //salle: getSalle(text),
        //groupe: getGroup(text),
        duree: toHour(div.clientWidth),
        horaire: toHour(parent.offsetLeft) + 8,
        jour: parent.offsetTop,
      });

      i++;
    }
    return matieres;
  }, '21L3-INF');
  console.log(matieres);
  // clearInterval(intervalID);
  await browser.close();
})();
