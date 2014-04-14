package com.joyent.piranha.test.performance.slb;

import com.joyent.piranha.pageobject.EditLoadBalancer;
import com.joyent.piranha.pageobject.LoadBalancers;
import com.joyent.piranha.util.TestWrapper;
import org.junit.BeforeClass;
import org.junit.Test;

import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selenide.page;

public class UpdateLBPefTest extends TestWrapper {

    @BeforeClass
    public static void startTest() {
        timeout = BASE_TIMEOUT;
    }

    @Test
    public void updateLoadBalancer() {
        LoadBalancers loadBalancers = page(EditLoadBalancer.class).clickUpdateButton();
        loadBalancers.waitForMediumSpinnerDisappear();
        loadBalancers.getCreateButton().waitUntil(visible, timeout);
    }
}
