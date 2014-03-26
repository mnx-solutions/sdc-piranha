package com.joyent.piranha.test;

import org.junit.runner.RunWith;
import org.junit.runners.Suite;
import org.junit.runners.Suite.SuiteClasses;

@RunWith(Suite.class)
@SuiteClasses({SmokeTest.class, InstanceCRUDTests.class,
        AccountPageTests.class, NetworkTests.class})
public class AllTests {

}
