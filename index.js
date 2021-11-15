const puppeteer = require('puppeteer');

const url = 'https://adecampus.univ-jfc.fr/direct/index.jsp?data=02427bf08a4e3905df54e3828781966417a0456235d61df4705fb52a51c95d7ffb650adbf17b96d5d97cc32ac608bd13facd4837bfc6fce1bd5d96a07a04824c5823238300f7365f22d90e079254e14d6a818c4c1a069cb98a008d7020f28ba25b66babf80b753289969c1b1e23d701d8a96fc2bd08f9dcf79c796321f919fe8bce01058236ed18878168cf46b2a937d2d2d5b9bb5b4cfc3e41a0fb5035c09561ec7656b708e82cc6634e50913e2a166074e24568258ccc0a0cbc04889b0dae1,1';
const sel = '#x-auto-99-input';
function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
(async () => {
  ////////////// Démarage et recherche de l'url //////////////
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto  (url);
  await page.screenshot({ path: 'screen.png' });
  // var intervalID = setInterval(() => page.screenshot({ path: 'screen.png' }), 200);

  ////////////// Recherche de l'emploi du temps //////////////
  // const frame = page.frames().find(frame => frame.url() === url);
  let input = await page.waitForSelector(sel);
  await timeout(100); // Sans ça ca marche une fois sur deux

  await page.$eval(sel, input => input.setAttribute('value', '21L3-INF'))
  // await input.type('21L3-INF'); // await page.keyboard.type('21L3-INF');
  await input.press('Enter'); // await page.keyboard.press('Enter');

  await page.screenshot({ path: 'screen.png' });

  await page.waitForSelector('#Planning');
  await page.screenshot({ path: 'screen.png' });


  ////////////// Récupération de l'emploi du temps //////////////
  const matieres = await page.evaluate(() => {
    let i = 0;
    const searchStr = '<br>ALB';
    let element;
    const matieres = [];

    // Tant que l'on a des matières à traiter
    while (element = document.getElementById('inner'+i)) {
      const text = element.innerHTML;
      const index = text.indexOf(searchStr) + searchStr.length;
      const salle = text.substring(text.indexOf(searchStr) + searchStr.length, text.lastIndexOf('<br>'))
        .replace(/ALB/g, '')
        .trim();
      // const salle = element.substring(index, element.lastIndexOf('<br>'));
      matieres.push({
        // filiere: element.firstChild.innerHTML,
        titre: element.firstChild.innerHTML,
        // jour,
        // horaire,
        // duree,
        salle,
        // groupe
      })
    // let prevParent;
      // const parent = element.parentNode;
      // // Si le parent n'est pas égale au précédent
      // if (parent != prevParent) {
      //   // console.log("parent", parent);
      //   // console.log("prevParent", prevParent);
      //   // C'est un nouveau jour
      //
      //   prevParent = parent;
      // }

      i++;
    }
    return matieres;
  });
  console.log(matieres);
  // clearInterval(intervalID);
  await browser.close();
})();
