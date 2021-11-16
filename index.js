const puppeteer = require('puppeteer');
const mysql = require('mysql');

const url = 'https://adecampus.univ-jfc.fr/direct/index.jsp?data=02427bf08a4e3905df54e3828781966417a0456235d61df4705fb52a51c95d7ffb650adbf17b96d5d97cc32ac608bd13facd4837bfc6fce1bd5d96a07a04824c5823238300f7365f22d90e079254e14d6a818c4c1a069cb98a008d7020f28ba25b66babf80b753289969c1b1e23d701d8a96fc2bd08f9dcf79c796321f919fe8bce01058236ed18878168cf46b2a937d2d2d5b9bb5b4cfc3e41a0fb5035c09561ec7656b708e82cc6634e50913e2a166074e24568258ccc0a0cbc04889b0dae1,1';
const sel = '#x-auto-99-input';

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
const con = mysql.createConnection(require('./creditential.json'));

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

  ////////////// Recherche de l'emploi du temps //////////////
  let input = await page.waitForSelector(sel);
  await timeout(100); // Sans ça ça marche une fois sur deux

  await page.$eval(sel, input => input.setAttribute('value', '21L3-INF')) // await input.type('21L3-INF');
  await input.press('Enter');
  await page.screenshot({ path: 'screen.png' });

  await page.waitForSelector('#Planning');
  await page.screenshot({ path: 'screen.png' });


  ////////////// Récupération de l'emploi du temps //////////////
  const matieres = await page.evaluate((filiere) => {
    let i = 0;
    let element;
    const matieres = [];
    const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const nbHour = (21.3-8);
    const {clientWidth: maxWidth, clientHeight: maxHeight} = document.getElementById('Planning');
    ////////////// Traitement de texte //////////////
    const getGroup = (text) => {
      let group = null;
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
    const toDay = (height) => {
      const i = Math.trunc(height * (days.length/maxHeight)+0.01);
      return days[i];
    }
    const toHour = (width, hourOffset=0) => {
      const h = width * (nbHour/maxWidth);
      const hours = Math.trunc(h);
      const m = (h-hours) * 100;

      let closestDif = m, minutes = 0;
      for (const norm of [25, 50, 75]) {
        const dif = Math.abs(norm - m);
        if (dif < closestDif) {
          closestDif = dif;
          minutes = norm * 0.6;
        }
      }
      const d = new Date(0);
      d.setHours(hours + hourOffset, minutes, 0);
      return d.toLocaleTimeString();
    };

    // Tant que l'on a des matières à traiter
    while (element = document.getElementById('inner'+i)) {
      const text = element.innerHTML;
      const div = document.getElementById('div'+i);
      const parent = div.parentElement;
      matieres.push([
        filiere, // Filiere
        element.firstChild.innerHTML, // Titre
        toDay(parent.offsetTop), // Jour
        toHour(parent.offsetLeft, 8), // Horaire
        toHour(div.clientWidth), // Duree
        getSalle(text), // Salle
        getGroup(text), // Groupe
      ]);

      i++;
    }
    return matieres;
  }, '21L3-INF');
  console.log(matieres);

  con.connect(function(err) {
    if (err) throw err;
    console.log('Connecté a la base de données');
    ////////////// Effacement de toute les valeurs //////////////
    con.query('TRUNCATE Schedule', function (err, res) {
      if (err) throw err;
      console.log('Données effacées');

      var sql = "INSERT INTO Schedule (filiere, titre, jour, horaire, duree, salle, groupe) VALUES ?";
      con.query(sql, [matieres], function (err, res) {
        if (err) throw err;
        console.log("Nombre de matieres inséré: " + res.affectedRows);
      });
    });
  });

  await browser.close();
})();
