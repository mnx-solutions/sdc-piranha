package com.joyent.piranha.pageobject;

import com.codeborne.selenide.Condition;
import com.codeborne.selenide.SelenideElement;
import org.apache.commons.lang3.text.WordUtils;
import org.openqa.selenium.By;

import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.page;
import static com.codeborne.selenide.Selenide.sleep;

public class CreateInstanceQuickStart extends AbstractPageObject implements CreateInstance {
    public static final String TITLE = "Quick Start: Create Instance";
    private boolean free;

    public CreateInstanceQuickStart(boolean free) {
        this.free = free;
    }

    @Override
    String getTitle() {
        return TITLE;
    }

    public CreateInstanceManual clickViewMoreImages() {
        $("#link-more-images").click();
        return page(CreateInstanceManual.class);
    }

    public void selectDataCenter(String datacenter) {
        waitForMediumSpinnerDisappear();
        $(".dropdown-toggle.datacenter-select").click();
        $("ul.dd-datacenter").$(byText(datacenter)).click();
    }

    public Instances clickLaunchButton(String tierName) {
        getImageRepeater(tierName, null, false).click();
        // by the reason i can't understand first click not always perform an action
        sleep(7000);
        if (!$("thead").exists()) {
            getImageRepeater(tierName, null, false).click();
        }
        return page(Instances.class);
    }

    public Instances clickLaunchButton(String tierName, String anotherText) {
        getImageRepeater(tierName, anotherText, false).waitUntil(Condition.visible, baseTimeout);
        getImageRepeater(tierName, anotherText, false).click();
        return page(Instances.class);
    }

    public Instances clickLaunchButton(String tierName, String anotherText, boolean isFree) {
        getImageRepeater(tierName, anotherText, isFree).waitUntil(Condition.visible, baseTimeout);
        getImageRepeater(tierName, anotherText, isFree).click();
        return page(Instances.class);
    }

    public SelenideElement getImageRepeater(String tierName) {
        return getImageRepeater(tierName, null, false);
    }

    public SelenideElement getImageRepeater(String tierName, String anotherText, boolean isFree) {
        final String anotherTextCondition = anotherText != null ? "and contains(., '" + anotherText + "') " : "";
        final String freeTierCondition = isFree ? " and contains(.,'FREE')" : " and not(contains(.,'FREE'))";
        return $(By.xpath("//div[@data-ng-repeat and contains(.,\'" + WordUtils.capitalize(tierName) + "\')" + anotherTextCondition + freeTierCondition + "]"));
    }

    public String getFreeTierInfo(String tierName) {
        return getImageRepeater(tierName).$(".freetier-info").getText();
    }

    @Override
    public Instances createInstance(InstanceVO instanceVO) {
        clickQuickLink();
        selectDataCenter(instanceVO.getDatacenter());
        return clickLaunchButton(instanceVO.getFreeTierName(), null, free);
    }

    private CreateInstanceQuickStart clickQuickLink() {
        $(By.xpath("//div/div[contains(@class,\"hotlinks\")]")).$(byText("Quick")).click();
        return new CreateInstanceQuickStart(free);
    }
}
