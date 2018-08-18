// const axios = require('axios'); // This works because webpack compiles the code into commonJS
import axios from 'axios';
import dompurify from 'dompurify';

function searchResultsHTML(stores) {
  return stores.map(store => {
    return `
      <a href="/stores/${store.slug}" class="search__result">
        <strong>${store.name}</strong>
      </a>
    `;
  }).join('');
}

function typeAhead(search) {
  if (!search) return;

  const searchInput = search.querySelector('input[name="search"]');
  const searchResults = search.querySelector('.search__results');

  // fetch search results via our search API
  searchInput.on('input', function() {
    if (!this.value) {
      searchResults.style.display = 'none';
      return;
    }
    searchResults.style.display = 'block';
    
    // TODO: debounce API hit rate
    axios.get(`/api/search?q=${this.value}`)
      .then(res => {
        const stores = res.data;
        if (stores.length > 0) {
          searchResults.innerHTML = dompurify.sanitize(searchResultsHTML(stores));
        } else {
          searchResults.innerHTML = dompurify.sanitize(
            `<div class="search__result">No results for <em>${this.value}</em></div>`);
        }
      })
      .catch(err => {
        console.error(err);
      });
  });

  const KEY_STROKES = {
    UP: 38,
    DOWN: 40,
    ENTER: 13
  }

  // handle keyboard inputs to highlight the selected search result
  searchInput.on('keyup', (e) => {
    if (!([KEY_STROKES.UP, KEY_STROKES.DOWN, KEY_STROKES.ENTER]).includes(e.keyCode)) {
      return;
    }
    
    const activeClass = 'search__result--active';
    const current = search.querySelector(`.${activeClass}`);
    const items = search.querySelectorAll('.search__result');
    let next;

    if (e.keyCode == KEY_STROKES.DOWN && current) {
      next = current.nextElementSibling || items[0];
    } else if (e.keyCode == KEY_STROKES.DOWN) {
      next = items[0];
    } else if (e.keyCode == KEY_STROKES.UP && current) {
      next = current.previousElementSibling || items[items.length - 1];
    } else if (e.keyCode == KEY_STROKES.UP) {
      next = items[items.length - 1];
    } else if (e.keyCode == KEY_STROKES.ENTER && current.href) {
      window.location = current.href;
      return;
    }
    if (current) {
      current.classList.remove(activeClass);
    }
    next.classList.add(activeClass);
  });

}

export default typeAhead;