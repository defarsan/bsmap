/*
 Core.js - part of bsmap

 Copyright (c) 2016 by Konstantin Kushnir <chpock@gmail.com>

 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
/* jslint browser:true */
// disable error in "use strict"; function
/* jslint node:true,sub:true */
"use strict";
function storageGet(key) {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}

function storageSet(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function storageHas(key) {
  return localStorage.getItem(key) !== null;
}

App.Core = function (){
  var center, zoom;

this.layers = {
  'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  })
};


/* Stamen Toner tiles is not https :(
    'Stamen Toner': L.tileLayer('http://{s}.tile.stamen.com/toner/{z}/{x}/{y}.png', {
      attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>',
      subdomains: 'abcd',
      minZoom: 0,
      maxZoom: 20
    }) */

try {
  const mapState = storageGet('map');
  if (mapState) {
    center = mapState.center;
    zoom = mapState.zoom;
  }
} catch (err) {
  console.log('error while setting map view:');
  console.log(err);
  center = null;
  zoom = null;
}

  if (!center) {
        center = new L.LatLng(50.4501, 30.5234);
  }
  zoom = zoom || 11;

  this.map = new L.Map('map', {
    center: center,
    zoom: zoom,
    zoomControl: false
  })
  .on({
  load: () => this.autocompleteBound(),
  viewreset: () => this.autocompleteBound(),
  dragend: () => this.autocompleteBound(),
  zoomend: () => this.autocompleteBound(),
  zoomlevelschange: () => this.autocompleteBound(),
  resize: () => this.autocompleteBound(),
  click: (e) => {
  if (this.panel.current_button !== 1) return;

  const azimuth = parseInt(this.panel.input_value_azimut, 10);

  if (isNaN(azimuth) || azimuth < 0 || azimuth > 360) {
    alert('Некоректний азимут (0-360)');
    return;
  }

  const color = this.panel.colorpicker_bs.getColor();

  this.buildBS(e.latlng, azimuth, color);
},
})
    .addLayer(this.layers['OpenStreetMap'])
    .addControl(new L.Control.Zoom({ position: "bottomleft" }));

  this.map_control_layers = new L.Control.Layers(this.layers);
  this.map.addControl(this.map_control_layers);

  this.panel = new L.Control.Panel();
  this.map.addControl(this.panel);
  
//L.DomEvent.addListener(this.panel.input_address, 'keyup', function(ev){
//  if (ev.keyCode !== 13) return;

 // const address = this.panel.input_address.value.trim();
//  this.searchAddress(address);
//}, this);

this.collection = {};

this.collection.address = new App.Collection({
  map: this.map,
  sidebar: document.getElementById('tbl_address'),
  save_id: 'tbl_address',
  objects: App.Address
}).loadFromStorage();

this.collection.bs = new App.Collection({
  map: this.map,
  sidebar: document.getElementById('tbl_bs'),
  save_id: 'tbl_bs',
  objects: App.BS
}).loadFromStorage();

this.collection.region = new App.Collection({
  map: this.map,
  sidebar: document.getElementById('tbl_region'),
  save_id: 'tbl_region',
  objects: App.Region
}).loadFromStorage();

  this.collection.save = new App.Collection({
    map: this.map,
    sidebar: document.getElementById('tbl_save'),
    save_id: 'tbl_save',
    objects: App.Saves
  }).loadFromStorage();

  L.DomEvent.addListener($('#new-button')[0], 'click', function(){
    noty({
      text: 'Вы действительно хотите очистить карту?',
      type: 'confirm',
      timeout: false,
      layout: 'center',
      theme: 'bsmap',
      modal: true,
      buttons: [
        {
          addClass: 'btn btn-primary',
          text: 'Очистить',
          onClick: (function(self){
            return function($noty) {
              $noty.close();
              for (var k in self.collection) {
                if (self.collection.hasOwnProperty(k) && k !== 'save')
                  self.collection[k].emptify();
              }
              self.collection.save.currentReset();
            };
          })(this)
        },{
          addClass: 'btn btn-danger',
          text: 'Отмена',
          onClick: function($noty) {
            $noty.close();
          }
        }
      ]
    });
  }, this);

  L.DomEvent.addListener($('#save-button')[0], 'click', function(){
    var save = this.collection.save.currentGet();
    if (!save) return;
    save.getCurrentMapState();
    save.redrawSidebar();
    noty({
      text: 'Карта "' + this.escapeHTML(save.options.title) + '" успешно сохранена.',
      type: 'success',
      timeout: 2000,
      layout: 'bottomCenter'
    });
  }, this);

  L.DomEvent.addListener($('#saveas-button')[0], 'click', function(){
    if (L.DomUtil.hasClass(this, 'save-button-disabled')) return;
    document.querySelector('.save-dialog').classList.add('open');
    L.DomUtil.addClass(this, 'save-button-disabled');
  }, $('#saveas-button')[0]);

  L.DomEvent.addListener($('#save-dialog-button-cancel')[0], 'click', function(){
    $('.save-dialog').slideUp(300);
    L.DomUtil.removeClass($('#saveas-button')[0], 'save-button-disabled');
  }, this);

  L.DomEvent.addListener($('#save-dialog-button-ok')[0], 'click', function(){
    var title = document
  .getElementById('save-dialog-input-title')
  .value
  .trim();
    if (title === '') {
      noty({
        text: 'Неможливо зберегти стан картки з порожнім іменем',
        type: 'error',
        timeout: 5000,
        layout: 'bottom',
        theme: 'bsmap'
      });
     document.getElementById('save-dialog-input-title').focus();
      return;
    }

    var save = this.collection.save.new({
      title: title,
      current: true
    });
    this.collection.save.currentUpdate(save);

    document.getElementById('save-button').click();

    document.getElementById('save-dialog-input-title').value = '';
    document.getElementById('save-dialog-button-cancel').click();
  }, this);
}; 
App.extend(App.Core, {
  autocompleteBound: function(){
  if (this.map) {
    storageSet('map', {
  center: this.map.getCenter(),
  zoom: this.map.getZoom()
});
  }
},
searchAddress: async function(address) {

  if (!address || address.trim() === '') return;

  if (address.includes('/')) {
    address = address.split('/')[1].trim();
  }

  try {
    const response = await fetch("http://localhost:3000/geocode?q=" + encodeURIComponent(address));
    const data = await response.json();

    if (!data || data.length === 0) {
      noty({
        text: 'Адресу не знайдено',
        type: 'warning',
        timeout: 3000,
        layout: 'bottomCenter',
        theme: 'bsmap'
      });
      return;
    }

    const lat = parseFloat(data[0].lat);
    const lon = parseFloat(data[0].lon);
    const location = L.latLng(lat, lon);

    this.map.flyTo(location, 15);

    this.collection.address.new({
      location: location,
      title: address,
      initial: true
    });

  } catch (err) {
    console.log("Geocode error:", err);
  }
},
normalizeAddress: function(address) {

  if (!address) return '';

  // 1. Відрізаємо азимут (280 / ...)
  if (address.includes('/')) {
    address = address.split('/')[1].trim();
  }

  address = address.toUpperCase();

  // 2. Прибираємо службові слова
  const garbageWords = [
    'ІСНУЮЧИЙ МАЙДАНЧИК БС',
    'ВЛАСНА ОПОРА',
    'ВЛАСНА ЩОГЛА',
    'ГБК',
    'АВТОСЕРВІС',
    'МАЙДАНЧИК БС',
    'БРОВАРСЬКА МІСЬКА ГРОМАДА'
  ];

  garbageWords.forEach(word => {
    address = address.replace(new RegExp(word, 'gi'), '');
  });

  // 3. Російські → українські
  address = address
    .replace(/КИЕВСКАЯ/gi, 'КИЇВСЬКА')
    .replace(/ОБУХОВСКИЙ/gi, 'ОБУХІВСЬКИЙ')
    .replace(/37-ИЙ КМ АВТОДОРОГИ КИЇВ-ОБУХІВ/gi, '');

  // 4. Скорочення
  address = address
    .replace(/ОБЛ\.?/gi, '')
    .replace(/Р-Н\.?/gi, '')
    .replace(/М\./gi, '')
    .replace(/С\./gi, '')
    .replace(/СЕЛО/gi, '')
    .replace(/ВУЛ\.?/gi, 'вулиця');

  // 5. Крапки → коми
  address = address.replace(/\./g, ',');

  // 6. Лапки
  address = address.replace(/"/g, '');

  // 7. Зайві пробіли і коми
  address = address
    .replace(/\s+/g, ' ')
    .replace(/,+/g, ',')
    .replace(/,\s*,/g, ',')
    .trim();

  return address;
},
searchStructuredAddress: async function() {

  const region = this.panel.input_region.value.trim();
  const settlement = this.panel.input_settlement.value.trim();
  const street = this.panel.input_street.value.trim();
  const house = this.panel.input_house.value.trim();
  const azimuth = parseInt(this.panel.input_azimuth.value, 10);
  const color = this.panel.input_color.value;
  const datetime = this.panel.input_datetime.value.trim();


  let parts = [];

  if (street) {
    let s = street;
    if (house) s += " " + house;
    parts.push(s);
  }

  if (settlement) parts.push(settlement);
  if (region) parts.push(region);

  parts.push("Україна");

  const query = parts.join(", ");

  try {
    const response = await fetch("http://localhost:3000/geocode?q=" + encodeURIComponent(query));
    const data = await response.json();

    if (!data || data.length === 0) {
      noty({
        text: 'Адресу не знайдено',
        type: 'warning',
        timeout: 3000,
        layout: 'bottomCenter',
        theme: 'bsmap'
      });
      return;
    }

    const lat = parseFloat(data[0].lat);
    const lon = parseFloat(data[0].lon);
    const location = L.latLng(lat, lon);

    this.map.flyTo(location, 16);

    // 🔥 Перевірка азимуту
    if (isNaN(azimuth) || azimuth < 0 || azimuth > 360) {
      noty({
        text: 'Некоректний азимут (0-360)',
        type: 'error',
        timeout: 3000,
        layout: 'bottomCenter',
        theme: 'bsmap'
      });
      return;
    }

    // 🔥 Будуємо БС одразу
  App.core.panel.current_button = 1;
App.core.buildBS(location, azimuth, color, query, datetime);
this.panel.current_button = 0;


  } catch (err) {
    console.log("Geocode error:", err);
  }
},
buildBS: function(location, azimuth, color, title, datetime) {

  this.collection.bs.new({
    location: location,
    azimut: azimuth, // саме azimut (так в старому коді)
    title: title || null,
    datetime: datetime || null,
    color: color,
    size: 500,
    initial: true
  });

},

  onClickAddress: function(item, e){
    if (this.panel.current_button !== 1) return;
    var text, self = this, colorpicker;
    text  = '<div style="margin-bottom: 13px;">Ви дійсно хочет побудувати БС на місці адреси?</div>';
    text += '<div style="height: 23px;padding: 5px 0px;text-align: left;text-overflow: ellipsis;overflow: hidden;white-space: nowrap">Адрес: <b>' + this.escapeHTML(item.options.title) + '</b></div>';
    text += '<div style="height: 23px;padding: 5px 0px;text-align: left">Азимут: <input class="tab-panel-input-azimut"></div>';
    text += '<div style="height: 23px;padding: 5px 0px;text-align: left;display:flex;align-items:center">Колір сектора:</div>';
    text += '<div style="height: 23px;padding: 5px 0px;text-align: left;display:flex;align-items:center"><input type="checkbox" checked>Видалити маркер адреса</div>';
    noty({
      text: text,
      type: 'confirm',
      timeout: false,
      layout: 'centerWide',
      theme: 'bsmap',
      modal: true,
      callback: {
        onShow: function(){
          $('ul#noty_center_wide_layout_container .tab-panel-input-azimut').val(self.panel.input_value_azimut);
          $('ul#noty_center_wide_layout_container .tab-panel-input-azimut').focus(function(){$(this).select();}).mouseup(function(e){e.preventDefault();});
          colorpicker = L.colorPicker()
            .addTo($('ul#noty_center_wide_layout_container div:eq(5)')[0])
            .setColor(self.panel.colorpicker_bs.getColor())
            .on('selected', function(){
              self.panel.colorpicker_bs.setColor(colorpicker.getColor());
            });
        }
      },
      buttons: [
        {
          addClass: 'btn btn-primary',
          text: 'Построить',
          onClick: function($noty) {
            var azimuth = self.buildBS_checkAzimuth($('ul#noty_center_wide_layout_container .tab-panel-input-azimut').val());
            if (azimuth === -1) {
              $('ul#noty_center_wide_layout_container .tab-panel-input-azimut').focus();
              return;
            }
            self.buildBS(item.options.location, azimuth, colorpicker.getColor());
            if (document.querySelector('#noty_center_wide_layout_container input[type="checkbox"]').checked) {
              self.collection.address.delete(item);
            }
            $noty.close();
          }
        },{
          addClass: 'btn btn-danger',
          text: 'Отмена',
          onClick: function($noty) {
            $noty.close();
          }
        }
      ]
    });
  },
   lookupRegion: function () {
    var lac = parseInt($('.tab-panel-input-lac').val(),10);
    var cid = parseInt($('.tab-panel-input-cid').val(),10);
    var mnc = parseInt($('.tab-panel-region-oper:checked').val(),10);
    if (isNaN(lac) || lac < 1 || lac > 65535) {
      noty({
        text: 'Невозможно найти местоположение БС: некорректное значение LAT. Значение LAT должно быть от 1 до 65535.',
        type: 'error',
        timeout: 5000,
        layout: 'bottomCenter',
        theme: 'bsmap'
      });
      this.panel._lookupRegionStop($('.tab-panel-input-lac')[0]);
      return;
    }
    if (isNaN(cid) || cid < 1 || cid > 65535) {
      noty({
        text: 'Невозможно найти местоположение БС: некорректное значение CID. Значение CID должно быть от 1 до 65535.',
        type: 'error',
        timeout: 5000,
        layout: 'bottomCenter',
        theme: 'bsmap'
      });
     this.panel._lookupRegionStop($('.tab-panel-input-cid')[0]);
     return;
    }
    if (isNaN(mnc) || mnc < 1 || mnc > 255) {
      noty({
        text: 'Невозможно найти местоположение БС: некорректное значение MNC. Значение MNC должно быть от 1 до 255.',
        type: 'error',
        timeout: 5000,
        layout: 'bottomCenter',
        theme: 'bsmap'
      });
     return;
    }
    var mcc = 255;
    var req = {
      done_g: true,
      done_y: false,
      done_m: true
    };
    var onComplete = function() {
      console.log('on complite');
      if (!req.obj) {
        var loc = req.g || req.y || req.m;
        if (loc) {
          this.map.flyTo([loc.lat,loc.lng]);
          req.obj = this.collection.region.new({
            color: this.panel.colorpicker_region.getColor(),
            lac: lac,
            cid: cid,
            mnc: mnc,
            mcc: mcc,
            location_g: req.g,
            location_y: req.y,
            location_m: req.m,
            initial: true
          });
        }
      } else {
        if (req.g) req.obj.setLocation('location_g', req.g);
        if (req.y) req.obj.setLocation('location_y', req.y);
        if (req.m) req.obj.setLocation('location_m', req.m);
      }
      delete req.g;
      delete req.y;
      delete req.m;
      if (req.done_g && req.done_y && req.done_m) this.panel._lookupRegionStop();
    };
    var onError = function(source, jqXHR, status, error, custommsg) {
      var msg;
      console.log('on error...');
      console.log(source);
      console.log(jqXHR);
      console.log(status);
      console.log(error);
      msg = 'Ошибка получения данных от источника "' + source + '" про работу БС с LAC: ' + lac + ' / Cellid: ' + cid +' оператора "' + mnc + '".';
      if (jqXHR && jqXHR.status !== 0) {
        msg += ' Статус ответа: "' + jqXHR.status + '".';
      }
      if (custommsg) {
        msg += ' ' + custommsg + '.';
      }
      noty({
        text: msg,
        type: 'error',
        timeout: 50000,
        layout: 'bottomCenter',
        theme: 'bsmap'
      });
    };
  }
});
App.core = new App.Core();
