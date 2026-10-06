<script setup lang="ts">
// Milestone 0: a "setup check" screen. It proves Vue, Vuetify, D3 and the
// icon font are all installed and wired. We replace it in milestone 2.
import { version as vueVersion } from 'vue'
import { version as vuetifyVersion } from 'vuetify'
import { scaleLinear } from 'd3'

// A D3 scale maps a domain (metres on the pitch) to a range (pixels).
// 0 m -> 0 px, 105 m -> 1050 px, so the centre spot (52.5 m) -> 525 px.
const xScale = scaleLinear().domain([0, 105]).range([0, 1050])
const centreSpotPx = xScale(52.5)
</script>

<template>
  <v-app>
    <v-app-bar color="primary" density="comfortable">
      <v-app-bar-title>
        <v-icon icon="mdi-soccer-field" class="mr-2" />
        Pitch Viewer
      </v-app-bar-title>
    </v-app-bar>

    <v-main>
      <v-container class="py-8" max-width="640">
        <v-card title="Setup check" subtitle="Milestone 0" prepend-icon="mdi-check-circle">
          <v-list density="compact">
            <v-list-item prepend-icon="mdi-vuejs" :title="`Vue ${vueVersion}`" />
            <v-list-item prepend-icon="mdi-vuetify" :title="`Vuetify ${vuetifyVersion}`" />
            <v-list-item
              prepend-icon="mdi-chart-line"
              :title="`D3 scale test: 52.5 m -> ${centreSpotPx} px`"
            />
          </v-list>
        </v-card>
      </v-container>
    </v-main>

    <v-footer app class="text-caption justify-center">
      Data: &nbsp;
      <a href="https://github.com/driblab/open-data" target="_blank" rel="noopener">
        Driblab open-data
      </a>
    </v-footer>
  </v-app>
</template>
