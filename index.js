const puppeteer = require('puppeteer');
const mysql = require('mysql');

const url = 'https://adecampus.univ-jfc.fr/direct/index.jsp?data=02427bf08a4e3905df54e3828781966417a0456235d61df4705fb52a51c95d7ffb650adbf17b96d5d97cc32ac608bd13facd4837bfc6fce1bd5d96a07a04824c5823238300f7365f22d90e079254e14d6a818c4c1a069cb98a008d7020f28ba25b66babf80b753289969c1b1e23d701d8a96fc2bd08f9dcf79c796321f919fe8bce01058236ed18878168cf46b2a937d2d2d5b9bb5b4cfc3e41a0fb5035c09561ec7656b708e82cc6634e50913e2a166074e24568258ccc0a0cbc04889b0dae1,1';
const sel = '#x-auto-99-input';
function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
const con = mysql.createConnection(require('./credential.json'));

(async () => {
  ////////////// Démarage et recherche de l'url //////////////
  const browser = await puppeteer.launch({
    args: [`--window-size=2000,1080`],
    defaultViewport: null
  }); /*{ headless: false, // The browser is visible
      ignoreHTTPSErrors: true,
      args: [`--window-size=2000,1080`], // new option
      defaultViewport: null }*/
  const filieres = ['21L1-PC', '21L1-INF', '21L1-MAT', '21L2-PC', '21L2-INF', '21L2-MAT', '21L3-PC', '21L3-INF', '21L3-MAT'];
  let matieres = [];

  for (let iFiliere = 0; iFiliere < filieres.length; iFiliere++) {
    ////////////// Recherche de l'emploi du temps //////////////
    const page = await browser.newPage();
    await page.goto(url);
    await page.screenshot({ path: 'screen.png' });
    const input = await page.waitForSelector(sel);
    await timeout(100); // Sans ça ça marche une fois sur deux
    await page.$eval(sel, (input, param) => input.setAttribute('value', param), filieres[iFiliere]) // await input.type('21L3-INF');
    await input.press('Enter');
    await page.screenshot({ path: 'screen.png' });
    await page.waitForSelector('#Planning');
    await page.screenshot({ path: 'screen.png' });
    ////////////// Récupération de l'emploi du temps //////////////
    matieres = matieres.concat(await page.evaluate(iFiliere => { // Execution côté client web
      const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'], nbHour = (21.3-8);
      const {clientWidth: maxWidth, clientHeight: maxHeight} = document.getElementById('Planning');
      ////////////// Fonction de traitement de texte //////////////
      const convert = (txt) => {
        if (! txt.includes('?')) return txt;
        const convertMap = {
          'yst?me': 'ystème',
          'lg?bre': 'lgèbre',
          ' ? ': ' à ',
          'ran?ais': 'rançais',
        }
        for (const word in convertMap) {
          txt = txt.replace(word, convertMap[word])
        }
        return txt;
      }
      const toTitle = element => {
        let txt = element.firstChild?.innerHTML
        if (! txt) {
          txt = element.innerText;
          let startIndex = 1;
          txt = txt.substring(startIndex, txt.substring(startIndex).indexOf('\n')+1);
        }
        return convert(txt);
      }
      const getGroup = txt => { // Récupère le groupe de la matière
        const i = txt.indexOf('Groupe-');
        if (i === -1) return null;
        const g = txt.charAt(i+7);
        return g === '0' ? txt.charAt(i+8) : g;
      }
      const getSalle = txt => {
        let startIndex = txt.indexOf('<br>ALB');
        let endIndex = txt.lastIndexOf('<br>');
        if (startIndex < 0){
          return txt.substring(txt.substring(0, endIndex).lastIndexOf('<br>') + 4, endIndex);
        }

        // Recupere les salles associées à l'activité
        let salles = txt.substring(startIndex+ 7, endIndex).match(/[A-Z][A-Z][0-9][0-9][0-9]/g);
        return salles.join(' ');
      };
      ////////////// Fonction jour et horaire //////////////
      const toDay = (height) => days[Math.trunc(height * (days.length/maxHeight)+0.01)];
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

      let i = 0, element;
      const matieres = [];
      // Tant que l'on a des matières à traîter
      while (element = document.getElementById('inner'+i)) {
        const text = element.innerHTML, div = document.getElementById('div'+i);
        const parent = div.parentElement;
        matieres.push([
          iFiliere, // Filiere
          toTitle(element), // Titre
          toDay(parent.offsetTop), // Jour
          toHour(parent.offsetLeft, 8), // Horaire
          toHour(div.clientWidth), // Duree
          getSalle(text), // Salle
          getGroup(text), // Groupe
        ]);
        i++;
      }
      return matieres;
    }, iFiliere+1));
    await page.close();
  };
  console.log(matieres);

  con.connect(function(err) {
    if (err) throw err;
    console.log('Connecté à la base de données');
    ////////////// Insertion Matières //////////////
    con.query('TRUNCATE Schedule', function (err, res) {
      if (err) throw err;
      console.log('Schedule effacées');

      const sql = "INSERT INTO Schedule (filiere, titre, jour, horaire, duree, salle, groupe) VALUES ?";
      con.query(sql, [matieres], function (err, res) {
        if (err) throw err;
        console.log("Nombre de matières insérées: " + res.affectedRows);
      });
    });
    ////////////// Insertion Filières //////////////
    con.query('TRUNCATE Filiere', function (err, res) {
      if (err) throw err;
      console.log('Filieres effacées');

      if (matieres.length === 0) {
          con.end();
          return;
      }
      const sql = "INSERT INTO Filiere (nom) VALUES ?";
      const query = [];
      for (let i = 0; i < filieres.length; i++) {
        query.push([filieres[i].substring(2).replace('-', ' ')]);
      }
      con.query(sql, [query], function (err, res) {
        if (err) throw err;
        console.log("Nombre de filières insérées: " + res.affectedRows);
        con.end();
      });
    });
  });
  await browser.close();
})();
