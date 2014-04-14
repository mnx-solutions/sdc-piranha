package com.joyent.piranha.test.performance.slb;

import org.junit.runner.RunWith;
import org.junit.runners.Suite;

@RunWith(Suite.class)
@Suite.SuiteClasses({InstallSLBPerfTest.class, CreateLBPerfTest.class, CreateLBPerfTest.class, ListLoadBalancersPerfTest.class, OpenLBEditPerfTest.class, UpdateLBPefTest.class, DeleteLBPerfTest.class, UninstallSLBPerfTest.class})
public class SLBPerformance {

}
