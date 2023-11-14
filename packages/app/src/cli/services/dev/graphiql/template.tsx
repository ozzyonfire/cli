import {platformAndArch} from '@shopify/cli-kit/node/os'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {
  AppProvider,
  BlockStack,
  Button,
  Card,
  Grid,
  Link,
  Page,
  Text,
} from '@shopify/polaris'

const controlKey = platformAndArch().platform === 'darwin' ? 'MAC_COMMAND_KEY' : 'Ctrl'

const graphiqlIntroMessage = `
# Welcome to the Shopify GraphiQL Explorer! If you've used GraphiQL before,
# you can go ahead and jump to the next tab.
#
# GraphiQL is an in-browser tool for writing, validating, and
# testing GraphQL queries.
#
# Type queries into this side of the screen, and you will see intelligent
# typeaheads aware of the current GraphQL type schema and live syntax and
# validation errors highlighted within the text.
#
# GraphQL queries typically start with a "{" character. Lines that start
# with a # are ignored.
#
# Keyboard shortcuts:
#
#   Prettify query:  Shift-${controlKey}-P (or press the prettify button)
#
#  Merge fragments:  Shift-${controlKey}-M (or press the merge button)
#
#        Run Query:  ${controlKey}-Enter (or press the play button)
#
#    Auto Complete:  ${controlKey}-Space (or just start typing)
#
`

export const defaultQuery = `query shopInfo {
  shop {
    name
    url
    myshopifyDomain
    plan {
      displayName
      partnerDevelopment
      shopifyPlus
    }
  }
}
`.replace(/\n/g, '\\n')

export const template = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>GraphiQL</title>
    <style>
      body {
        height: 100%;
        margin: 0;
        width: 100%;
        overflow: hidden;
      }
      .top-bar {
        padding: 0 4px;
        border-bottom: 1px solid #d6d6d6;
        font-family: sans-serif;
        font-size: 0.85em;
        color: #666;
      }
      .top-bar a {
        text-decoration: none;
      }
      #top-error-bar {
        display: none;
        background-color: #ff0000;
        color: #ffffff;
      }
      .top-bar p {
        margin: 0;
      }
      .top-bar .container {
        margin: 0;
        display: flex;
        flex-direction: row;
        align-content: start;
        align-items: stretch;
      }
      .top-bar .container:not(.bounded) {
        width: 100%;
      }
      .top-bar .container.bounded {
        max-width: 1200px;
        flex-wrap: wrap;
      }
      .top-bar .box {
        padding: 8px;
        text-align: left;
        align-self: center;
      }
      .top-bar .box.align-right {
        text-align: right;
        flex-grow: 1;
      }
      #graphiql {
        height: 100vh;
        display: flex;
        flex-direction: column;
      }
      #graphiql-explorer {
        flex-grow: 1;
        overflow: auto;
      }
    </style>
    <script
      src="https://unpkg.com/react@17/umd/react.development.js"
      integrity="sha512-Vf2xGDzpqUOEIKO+X2rgTLWPY+65++WPwCHkX2nFMu9IcstumPsf/uKKRd5prX3wOu8Q0GBylRpsDB26R6ExOg=="
      crossorigin="anonymous"
    ></script>
    <script
      src="https://unpkg.com/react-dom@17/umd/react-dom.development.js"
      integrity="sha512-Wr9OKCTtq1anK0hq5bY3X/AvDI5EflDSAh0mE9gma+4hl+kXdTJPKZ3TwLMBcrgUeoY0s3dq9JjhCQc7vddtFg=="
      crossorigin="anonymous"
    ></script>
    <link rel="stylesheet" href="https://unpkg.com/graphiql/graphiql.min.css" />
  </head>
  <body>
    <div id="graphiql">
      <div id="top-error-bar" class="top-bar">
        <div class="box">⚠️ The server has been stopped. Restart <code>dev</code> and launch the GraphiQL Explorer from the terminal again.</div>
      </div>
      <div class="top-bar">
        <div class="container">
          <div class="container bounded">
            <div class="box">
              Status: <span id="status">🟢 Running</span>
            </div>
            <div class="box">
              API version:
              <select id="version-select">
                {% for version in versions %}
                  <option value="{{ version }}" {% if version == apiVersion %}selected{% endif %}>{{ version }}</option>
                {% endfor %}
              </select>
            </div>
            <div class="box">
              Store: <a href="https://{{ storeFqdn }}/admin" target="_blank">{{ storeFqdn }}</a>
            </div>
            <div class="box">
              App: <a href="{{ appUrl }}" target="_blank">{{ appName }}</a>
            </div>
          </div>
          <div class="box align-right">
            The GraphiQL Explorer uses the access scopes declared in your app's configuration file.
          </div>
        </div>
      </div>
      <div id="graphiql-explorer">Loading...</div>
    </div>
    <script
      src="https://unpkg.com/graphiql@3.0.4/graphiql.min.js"
      type="application/javascript"
    ></script>
    <script>
      const macCommandKey = String.fromCodePoint(8984)
      const renderGraphiQL = function(apiVersion) {
        ReactDOM.render(
          React.createElement(GraphiQL, {
            fetcher: GraphiQL.createFetcher({
              url: '{{url}}/graphiql/graphql.json?api_version=' + apiVersion,
            }),
            defaultEditorToolsVisibility: true,
            defaultTabs: [
              {query: "${graphiqlIntroMessage
                .replace(/"/g, '\\"')
                .replace(/\n/g, '\\n')}".replace(/MAC_COMMAND_KEY/g, macCommandKey)},
              {%for query in defaultQueries%}
                {query: "{%if query.preface %}{{query.preface}}\\n{% endif %}{{query.query}}", variables: "{{query.variables}}"},
              {%endfor%}
            ],
          }),
          document.getElementById('graphiql-explorer'),
        )
      }
      renderGraphiQL('{{apiVersion}}')

      // Update the version when the select changes
      document.getElementById('version-select').addEventListener('change', function(event) {
        renderGraphiQL(event.target.value)
      })

      // Warn when the server has been stopped
      const pingInterval = setInterval(function() {
        const topErrorBar = document.querySelector('#graphiql #top-error-bar')
        const statusDiv = document.querySelector('#graphiql #status')
        const displayErrorServerStopped = function() {
          topErrorBar.style.display = 'block'
          statusDiv.innerHTML = '❌ Disconnected'
        }
        const displayErrorServerStoppedTimeout = setTimeout(displayErrorServerStopped, 3000)
        fetch('{{url}}/graphiql/ping')
          .then(function(response) {
            if (response.status === 200) {
              clearTimeout(displayErrorServerStoppedTimeout)
              topErrorBar.style.display = 'none'
              statusDiv.innerHTML = '🟢 Running'
            } else {
              displayErrorServerStopped()
            }
          })
      }, 2000)
    </script>
  </body>
</html>
`

const shopifySvg = <svg width="102" height="28" viewBox="0 0 102 28" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M21.4028 5.3032C21.3836 5.16414 21.2615 5.08697 21.16 5.07856C21.0594 5.07016 19.0881 5.04036 19.0881 5.04036C19.0881 5.04036 17.4395 3.44802 17.2767 3.28603C17.1138 3.12405 16.7957 3.17295 16.6721 3.20962C16.6705 3.21039 16.3625 3.30513 15.8439 3.46483C15.7571 3.18517 15.6296 2.84134 15.4475 2.49597C14.8606 1.38194 14.0009 0.792838 12.9623 0.79131C12.9608 0.79131 12.96 0.79131 12.9585 0.79131C12.8862 0.79131 12.8148 0.798187 12.7426 0.804299C12.7119 0.767624 12.6811 0.731712 12.6489 0.696564C12.1964 0.215194 11.6164 -0.0193788 10.9211 0.00125134C9.57979 0.0394553 8.24384 1.00296 7.16064 2.7145C6.39856 3.91869 5.81855 5.43157 5.65415 6.6029C4.11386 7.0774 3.0368 7.40901 3.01299 7.41665C2.23554 7.65962 2.21096 7.68331 2.10955 8.41224C2.03427 8.96314 0 24.6084 0 24.6084L17.0477 27.541L24.4365 25.7141C24.4365 25.7141 21.422 5.44226 21.4028 5.3032ZM14.9904 3.72767C14.5979 3.84839 14.1515 3.98593 13.6675 4.13492C13.6575 3.45948 13.5769 2.51966 13.2604 1.70744C14.2783 1.89923 14.7792 3.04458 14.9904 3.72767ZM12.7756 4.40999C11.8822 4.68506 10.9073 4.98534 9.92933 5.28639C10.2044 4.23884 10.726 3.19587 11.3667 2.51202C11.6048 2.25758 11.9382 1.97411 12.3331 1.81212C12.7042 2.58231 12.7848 3.67266 12.7756 4.40999ZM10.948 0.889112C11.263 0.882236 11.528 0.951003 11.7546 1.09923C11.392 1.28643 11.0417 1.55539 10.7129 1.9061C9.86096 2.81536 9.20797 4.22661 8.94754 5.5882C8.13552 5.83806 7.34118 6.08333 6.60983 6.30797C7.07153 4.16472 8.87763 0.94871 10.948 0.889112Z" fill="#95BF47"/>
  <path d="M21.1611 5.07934C21.0605 5.07093 19.0892 5.04114 19.0892 5.04114C19.0892 5.04114 17.4406 3.44879 17.2778 3.28681C17.2171 3.22645 17.1349 3.19512 17.0488 3.18213L17.0496 27.5402L24.4376 25.7141C24.4376 25.7141 21.4231 5.44304 21.4039 5.30398C21.3847 5.16492 21.2618 5.08774 21.1611 5.07934Z" fill="#5E8E3E"/>
  <path d="M12.9528 8.85773L12.0947 12.0508C12.0947 12.0508 11.1375 11.6176 10.0028 11.6886C8.33885 11.7933 8.32118 12.8371 8.33808 13.0991C8.42873 14.5272 12.2061 14.8389 12.4181 18.1841C12.5848 20.8156 11.0146 22.6158 8.75216 22.7579C6.03647 22.9283 4.5415 21.3352 4.5415 21.3352L5.11691 18.9008C5.11691 18.9008 6.62186 20.0301 7.82644 19.9545C8.61311 19.9048 8.89428 19.2683 8.86585 18.8183C8.74755 16.9554 5.67157 17.0655 5.4772 14.0046C5.31357 11.4289 7.01443 8.81876 10.7672 8.58343C12.213 8.49097 12.9528 8.85773 12.9528 8.85773Z" fill="white"/>
  <path d="M34.1664 15.544C33.3168 15.0855 32.8802 14.699 32.8802 14.1677C32.8802 13.4917 33.4867 13.0575 34.4338 13.0575C35.5364 13.0575 36.5208 13.516 36.5208 13.516L37.2973 11.15C37.2973 11.15 36.5833 10.5945 34.4818 10.5945C31.5574 10.5945 29.5306 12.2602 29.5306 14.602C29.5306 15.9297 30.4769 16.9437 31.7395 17.6675C32.759 18.2465 33.1232 18.6572 33.1232 19.2605C33.1232 19.888 32.6135 20.395 31.6671 20.395C30.2567 20.395 28.9248 19.6705 28.9248 19.6705L28.0996 22.0365C28.0996 22.0365 29.3302 22.8572 31.4004 22.8572C34.4102 22.8572 36.5704 21.3847 36.5704 18.7292C36.5696 17.306 35.4777 16.292 34.1664 15.544Z" fill="black"/>
  <path d="M46.1564 10.571C44.6759 10.571 43.5108 11.2712 42.6132 12.333L42.5645 12.3087L43.8507 5.62222H40.5011L37.249 22.6405H40.5986L41.7149 16.8232C42.1515 14.6262 43.2922 13.275 44.3604 13.275C45.1125 13.275 45.4043 13.782 45.4043 14.5065C45.4043 14.965 45.3555 15.5205 45.2588 15.979L43.997 22.6412H47.3466L48.6571 15.7615C48.8027 15.037 48.9002 14.1685 48.9002 13.5887C48.8987 11.7055 47.9036 10.571 46.1564 10.571Z" fill="black"/>
  <path d="M56.4709 10.571C52.4416 10.571 49.7725 14.192 49.7725 18.223C49.7725 20.8058 51.3741 22.8815 54.3839 22.8815C58.34 22.8815 61.0099 19.3575 61.0099 15.2295C61.0099 12.84 59.6018 10.571 56.4709 10.571ZM54.8205 20.3238C53.6798 20.3238 53.1944 19.3583 53.1944 18.151C53.1944 16.2443 54.1896 13.1303 56.0099 13.1303C57.1993 13.1303 57.5872 14.1443 57.5872 15.134C57.5872 17.1855 56.5928 20.3238 54.8205 20.3238Z" fill="black"/>
  <path d="M69.5778 10.571C67.3171 10.571 66.0339 12.5505 66.0339 12.5505H65.9859L66.1802 10.7643H63.2192C63.0737 11.9715 62.8062 13.8055 62.5396 15.1818L60.2095 27.3718H63.5591L64.481 22.4473H64.5542C64.5542 22.4473 65.2415 22.8815 66.5201 22.8815C70.4518 22.8815 73.0242 18.8748 73.0242 14.8187C73.0242 12.5748 72.029 10.571 69.5778 10.571ZM66.3738 20.3715C65.5044 20.3715 64.99 19.8888 64.99 19.8888L65.5485 16.7748C65.9371 14.699 67.029 13.3228 68.1941 13.3228C69.2136 13.3228 69.529 14.264 69.529 15.1575C69.529 17.306 68.2428 20.3715 66.3738 20.3715Z" fill="black"/>
  <path d="M77.8058 5.79121C76.7383 5.79121 75.8887 6.63622 75.8887 7.72221C75.8887 8.71197 76.5196 9.38797 77.4659 9.38797H77.5147C78.5586 9.38797 79.4562 8.68771 79.4806 7.45697C79.4806 6.49147 78.8253 5.79121 77.8058 5.79121Z" fill="black"/>
  <path d="M73.1216 22.6405H76.4704L78.7525 10.837H75.3785L73.1216 22.6405Z" fill="black"/>
  <path d="M87.2711 10.8127H84.9411L85.0622 10.2572C85.2565 9.12274 85.9362 8.10874 87.0525 8.10874C87.6483 8.10874 88.12 8.27774 88.12 8.27774L88.7753 5.67074C88.7753 5.67074 88.1931 5.38124 86.9549 5.38124C85.7655 5.38124 84.5768 5.71924 83.6785 6.49149C82.5378 7.45699 82.0037 8.85674 81.737 10.2572L81.6402 10.8127H80.0866L79.6012 13.3235H81.1549L79.3833 22.6413H82.7329L84.5045 13.3235H86.8102L87.2711 10.8127Z" fill="black"/>
  <path d="M95.3288 10.837C95.3288 10.837 93.2349 16.0836 92.2947 18.9475H92.2459C92.1819 18.0252 91.4207 10.837 91.4207 10.837H87.9012L89.9166 21.675C89.9653 21.916 89.9409 22.0615 89.8434 22.2305C89.4548 22.9785 88.7995 23.703 88.0231 24.2343C87.3922 24.6928 86.6881 24.9823 86.1304 25.1755L87.0523 28C87.732 27.8553 89.1394 27.2998 90.3288 26.1895C91.858 24.7655 93.2654 22.5685 94.7215 19.575L98.8231 10.8362H95.3288V10.837Z" fill="black"/>
</svg>

const polarisUnauthorizedContent = renderToStaticMarkup(
  <AppProvider i18n={{}}>
    <Page narrowWidth>
      <div className="max-width-400px">
        <Card>
          <BlockStack gap="400">
            {shopifySvg}
            <div id="pre-install">
              <BlockStack gap="200">
                <Text variant="headingMd" as="h2">
                  Install your app to access GraphiQL
                </Text>
                <p>
                  The GraphiQL Explorer relies on your app being installed on your development store to access its data.
                </p>
                <p id="card-cta">
                  <Button id="app-install-button">
                    Install your app
                  </Button>
                </p>
              </BlockStack>
            </div>

            <div id="post-install">
              <Text variant="headingMd" as="h2">
                Loading GraphiQL...
              </Text>
              <p>
                If you're not redirected automatically,{' '}
                <Link url="{{url}}/graphiql">click here</Link>.
              </p>
            </div>
          </BlockStack>
        </Card>
      </div>
    </Page>
  </AppProvider>
)

export const unauthorizedTemplate = `
<!DOCTYPE html>
<html>
  <head>
    <title>GraphiQL Explorer - App Not Installed</title>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">

    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="https://unpkg.com/@shopify/polaris@12.1.1/build/esm/styles.css" />
    <style>
      .vertical-center {
        display: flex;
        flex-direction: row;
        align-items: center;
        height: 100%;
      }
      .max-width-400px {
        max-width: 400px;
      }
      #post-install {
        display: none;
      }
    </style>

    <script type="text/javascript">
      let appInstalled = false
      let newTab = null

      setInterval(function() {
        fetch('{{ url }}/graphiql/status')
          .then(async function(response) {
            const body = await response.json()
            if (body.status === 'OK') {
              if (newTab) newTab.close()
              document.getElementById('pre-install').style.display = 'none'
              document.getElementById('post-install').style.display = 'block'
              window.location.href = window.location.href
            }
          })
      }, 5000)

      function openAppInstallTab() {
        newTab = window.open('{{ previewUrl }}', '_blank')
      }

      document.addEventListener("DOMContentLoaded", function() {
        document.getElementById('app-install-button').onclick = openAppInstallTab
      })
    </script>
  </head>
  <body>
    <div class="vertical-center">
      ${polarisUnauthorizedContent}
    </div>
  </body>
</html>
`
