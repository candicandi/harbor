(function() {
  
  'use strict';
  
  angular
    .module('harbor.replication')
    .directive('listReplication', listReplication)
    .factory('jobStatus', jobStatus);

  jobStatus.inject = ['$filter', 'trFilter'];
  function jobStatus($filter, trFilter) {
    return function() {      
      return [
        {'key': 'all'    , 'value': $filter('tr')('all')},
        {'key': 'pending', 'value': $filter('tr')('pending')},
        {'key': 'running', 'value': $filter('tr')('running')},
        {'key': 'error'  , 'value': $filter('tr')('error')},
        {'key': 'retrying', 'value': $filter('tr')('retrying')},
        {'key': 'stopped', 'value': $filter('tr')('stopped')}, 
        {'key': 'finished', 'value':$filter('tr')('finished')},
        {'key': 'canceled', 'value': $filter('tr')('canceled')}
      ];
    }
  }
  
  ListReplicationController.$inject = ['$scope', 'getParameterByName', '$location', 'ListReplicationPolicyService', 'ToggleReplicationPolicyService', 'ListReplicationJobService', '$window', '$filter', 'trFilter', 'jobStatus'];
  
  function ListReplicationController($scope, getParameterByName, $location, ListReplicationPolicyService, ToggleReplicationPolicyService, ListReplicationJobService, $window, $filter, trFilter, jobStatus) {
    var vm = this;
    
    vm.sectionHeight = {'min-height': '1200px'};
      
    $scope.$on('$locationChangeSuccess', function() {
      vm.projectId = getParameterByName('project_id', $location.absUrl());
      vm.retrievePolicy();
    });
    
    vm.addReplication = addReplication;
    vm.editReplication = editReplication;
    
    vm.searchReplicationPolicy = searchReplicationPolicy;
    vm.searchReplicationJob = searchReplicationJob;
    vm.refreshReplicationJob = refreshReplicationJob;
    
    vm.retrievePolicy = retrievePolicy;
    vm.retrieveJob = retrieveJob;
    vm.togglePolicy = togglePolicy;
    
    vm.downloadLog = downloadLog;
      
    vm.last = false;
    
    vm.projectId = getParameterByName('project_id', $location.absUrl());
    vm.retrievePolicy();
       
    vm.jobStatus = jobStatus;
    vm.currentStatus = vm.jobStatus()[0];
   
    vm.pickUp = pickUp;
    
    vm.searchJobTIP = false;
    vm.refreshJobTIP = false;
        
    function searchReplicationPolicy() {
      vm.retrievePolicy();
    }   
    
    function searchReplicationJob() {
      if(vm.lastPolicyId !== -1) {
        vm.searchJobTIP = true;
        vm.retrieveJob(vm.lastPolicyId);
      }
    }            
    
    function refreshReplicationJob() {
      if(vm.lastPolicyId !== -1) {
        vm.refreshJobTIP = true;
        vm.retrieveJob(vm.lastPolicyId);
      }
    }
   
    function retrievePolicy() {
      ListReplicationPolicyService('', vm.projectId, vm.replicationPolicyName)
        .success(listReplicationPolicySuccess)
        .error(listReplicationPolicyFailed);
    }
    
    function retrieveJob(policyId) {
      var status = (vm.currentStatus.key === 'all' ? '' : vm.currentStatus.key);
      ListReplicationJobService(policyId, vm.replicationJobName, status, toUTCSeconds(vm.fromDate, 0, 0, 0), toUTCSeconds(vm.toDate, 23, 59, 59))
        .success(listReplicationJobSuccess)
        .error(listReplicationJobFailed);
    }

    function listReplicationPolicySuccess(data, status) {
      vm.replicationJobs = [];
      vm.replicationPolicies = data || [];
    }
    
    function listReplicationPolicyFailed(data, status) {
      console.log('Failed to list replication policy:' + data);      
    }

    function listReplicationJobSuccess(data, status) {
      vm.replicationJobs = data || [];
      var alertInfo = {
        'show': false,
        'message': ''
      };
      angular.forEach(vm.replicationJobs, function(item) {
        for(var key in item) {          
          var value = item[key];
          if(key === 'status' && (value === 'error' || value === 'retrying')) {
            alertInfo.show = true;
            alertInfo.message = $filter('tr')('alert_job_contains_error');
          }
          switch(key) {
          case 'operation':            
          case 'status':
            item[key] = $filter('tr')(value);
          default:
            break;
          }
        }
      });
     
      $scope.$emit('raiseAlert', alertInfo);
      vm.searchJobTIP = false;
      vm.refreshJobTIP = false;
    }
    
    function listReplicationJobFailed(data, status) {
      console.log('Failed to list replication job:' + data);
      vm.searchJobTIP = false;
      vm.refreshJobTIP = false;
    }

    function addReplication() {
      vm.modalTitle = $filter('tr')('add_new_policy', []);
      vm.action = 'ADD_NEW';
    }
    
    function editReplication(policyId) {
      vm.policyId = policyId;
      vm.modalTitle = $filter('tr')('edit_policy', []);
      vm.action = 'EDIT';
      
      console.log('Selected policy ID:' + vm.policyId);
    }
     
    function togglePolicy(policyId, enabled) {
      ToggleReplicationPolicyService(policyId, enabled)
        .success(toggleReplicationPolicySuccess)
        .error(toggleReplicationPolicyFailed);
    }
    
    function toggleReplicationPolicySuccess(data, status) {
      console.log('Successful toggle replication policy.');
      vm.retrievePolicy();
    }
    
    function toggleReplicationPolicyFailed(data, status) {
      console.log('Failed to toggle replication policy.');
    }
    
    function downloadLog(policyId) {
      $window.open('/api/jobs/replication/' + policyId + '/log', '_blank');
    }
    
    function pickUp(e) {
      switch(e.key){
      case 'fromDate':
        vm.fromDate = e.value;  
        break;
      case 'toDate':
        vm.toDate = e.value;
        break;
      }
      $scope.$apply();
    }
    
    function toUTCSeconds(date, hour, min, sec) {
      if(!angular.isDefined(date) || date === '') {
        return '';
      }
			var t = new Date(date);
			t.setHours(hour);
			t.setMinutes(min);
			t.setSeconds(sec);
			return t.getTime() / 1000;
		}
  
  }
  
  function listReplication($timeout) {
    var directive = {
      'restrict': 'E',
      'templateUrl': '/static/resources/js/components/replication/list-replication.directive.html',
      'scope': {
        'sectionHeight': '='
      },
      'link': link,
      'controller': ListReplicationController,
      'controllerAs': 'vm',
      'bindToController': true
    };
    return directive;
    
    function link(scope, element, attrs, ctrl) {
      /*     
      var uponPaneHeight = element.find('#upon-pane').height();
      var handleHeight = element.find('.split-handle').height() + element.find('.split-handle').offset().top + element.find('.well').height() - 24;
      
      var maxDownPaneHeight = 245;
            
      element.find('.split-handle').on('mousedown', mousedownHandler);
      
      function mousedownHandler(e) {
        e.preventDefault();
        $(document).on('mousemove', mousemoveHandler);    
        $(document).on('mouseup', mouseupHandler);
      }
      
      function mousemoveHandler(e) {
        if(element.find('#down-pane').height() <= maxDownPaneHeight) {
          element.find('#upon-pane').css({'height' : (uponPaneHeight - (handleHeight - e.pageY)) + 'px'});
          element.find('#down-pane').css({'height' : (uponPaneHeight + (handleHeight - e.pageY - 196)) + 'px'});  
        }else{
          element.find('#down-pane').css({'height' : (maxDownPaneHeight) + 'px'});
          $(document).off('mousemove');
        }	
      }
      function mouseupHandler(e) {
        $(document).off('mousedown');
        $(document).off('mousemove');
      }
      */
      ctrl.lastPolicyId = -1;          
      
      scope.$watch('vm.replicationPolicies', function(current) { 
        $timeout(function(){
          if(current) {
            if(current.length > 0) {
              element.find('#upon-pane table>tbody>tr').on('click', trClickHandler);
              if(ctrl.lastPolicyId === -1) {
                element.find('#upon-pane table>tbody>tr:eq(0)').trigger('click');  
              }else{
                element.find('#upon-pane table>tbody>tr').filter('[policy_id="' + ctrl.lastPolicyId + '"]').trigger('click');
              }
            }else{
               element
                .find('#upon-pane table>tbody>tr')  
                .css({'background-color': '#FFFFFF'})
                .css({'color': '#000'});
            }
          }
        });
      });
         
      function trClickHandler(e) {
        element
          .find('#upon-pane table>tbody>tr')  
          .css({'background-color': '#FFFFFF'})
          .css({'color': '#000'})
          .css({'cursor': 'default'});
        element
          .find('#upon-pane table>tbody>tr a')
          .css({'color': '#337ab7'});          
        $(this)
          .css({'background-color': '#057ac9'})
          .css({'color': '#fff'});
        $('a', this)
          .css({'color': '#fff'});
        ctrl.retrieveJob($(this).attr('policy_id'));
        ctrl.lastPolicyId = $(this).attr('policy_id');
      }
      
      element.find('.datetimepicker').datetimepicker({
				locale: 'en-US',
				ignoreReadonly: true,
				format: 'L',
				showClear: true
		  });      
      element.find('#fromDatePicker').on('blur', function(){
        ctrl.pickUp({'key': 'fromDate', 'value': $(this).val()});
      });
      element.find('#toDatePicker').on('blur', function(){
        ctrl.pickUp({'key': 'toDate', 'value': $(this).val()});
      });
    }
  }
  
})();