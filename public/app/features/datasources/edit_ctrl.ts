///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import coreModule from 'app/core/core_module';
import config from 'app/core/config';

var datasourceTypes = [];

var defaults = {
  name: '',
  type: 'graphite',
  url: '',
  access: 'proxy',
  jsonData: {}
};

export class DataSourceEditCtrl {
  isNew: boolean;
  datasources: any[];
  current: any;
  types: any;
  testing: any;
  datasourceMeta: any;
  tabIndex: number;
  hasDashboards: boolean;

  /** @ngInject */
  constructor(
    private $scope,
    private $q,
    private backendSrv,
    private $routeParams,
    private $location,
    private datasourceSrv) {

      this.isNew = true;
      this.datasources = [];
      this.tabIndex = 0;

      this.loadDatasourceTypes().then(() => {
        if (this.$routeParams.id) {
          this.getDatasourceById(this.$routeParams.id);
        } else {
          this.current = angular.copy(defaults);
          this.typeChanged();
        }
      });
    }

    loadDatasourceTypes() {
      if (datasourceTypes.length > 0) {
        this.types = datasourceTypes;
        return this.$q.when(null);
      }

      return this.backendSrv.get('/api/org/plugins', {enabled: 1, type: 'datasource'}).then(plugins => {
        datasourceTypes = plugins;
        this.types = plugins;
      });
    }

    getDatasourceById(id) {
      this.backendSrv.get('/api/datasources/' + id).then(ds => {
        this.isNew = false;
        this.current = ds;
        return this.typeChanged();
      });
    }

    typeChanged() {
      this.hasDashboards = false;
      return this.backendSrv.get('/api/org/plugins/' + this.current.type + '/settings').then(pluginInfo => {
        this.datasourceMeta = pluginInfo;
        this.hasDashboards = _.findWhere(pluginInfo.includes, {type: 'dashboard'});
      });
    }

    updateFrontendSettings() {
      return this.backendSrv.get('/api/frontend/settings').then(settings => {
        config.datasources = settings.datasources;
        config.defaultDatasource = settings.defaultDatasource;
        this.datasourceSrv.init();
      });
    }

    testDatasource() {
      this.testing = { done: false };

      this.datasourceSrv.get(this.current.name).then(datasource => {
        if (!datasource.testDatasource) {
          this.testing.message = 'Data source does not support test connection feature.';
          this.testing.status = 'warning';
          this.testing.title = 'Unknown';
          return;
        }

        return datasource.testDatasource().then(result => {
          this.testing.message = result.message;
          this.testing.status = result.status;
          this.testing.title = result.title;
        }).catch(err => {
          if (err.statusText) {
            this.testing.message = err.statusText;
            this.testing.title = "HTTP Error";
          } else {
            this.testing.message = err.message;
            this.testing.title = "Unknown error";
          }
        });
      }).finally(() => {
        this.testing.done = true;
      });
    }

    saveChanges(test) {
      if (!this.$scope.editForm.$valid) {
        return;
      }

      if (this.current.id) {
        return this.backendSrv.put('/api/datasources/' + this.current.id, this.current).then(() => {
          this.updateFrontendSettings().then(() => {
            if (test) {
              this.testDatasource();
            }
          });
        });
      } else {
        return this.backendSrv.post('/api/datasources', this.current).then(result => {
          this.updateFrontendSettings();
          this.$location.path('datasources/edit/' + result.id);
        });
      }
    };
}

coreModule.controller('DataSourceEditCtrl', DataSourceEditCtrl);

coreModule.directive('datasourceHttpSettings', function() {
  return {
    scope: {current: "="},
    templateUrl: 'public/app/features/datasources/partials/http_settings.html'
  };
});